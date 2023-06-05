import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { Field, IndexedFieldOptions, IndexValue } from './Field';
import { capitalize, depluralize } from './utils';
import { Model, ParseOptions } from './Model';


export class ManyToManyField extends Field {
  readonly options: IndexedFieldOptions;
  readonly model: Model;

  constructor(model:Model, options: IndexedFieldOptions = {}) {
    super(model.schema(), options);
    this.model = model;
    this.options = options;
  }

  schema(options:ParseOptions = {}):z.ZodType<any>{
    return this.model.schema(options)
  }

  query(modelName: string, fieldName: string):Expr {
    const indexName = `${capitalize(fieldName)}_by_${modelName}`;

    return q.Select(
      "data",
      q.Map(
        q.Paginate(q.Match(q.Index(indexName), q.Var('ref'))),
        q.Lambda(
          'values', 
          this.model.dereference(
            q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')))
          )
      )
    )
  }

  construct(modelName: string, fieldName: string) {
    const toField = this.options.singular || depluralize(fieldName)
    const fromField = modelName.toLowerCase()
    const tertiaryTable = `${modelName}${capitalize(toField)}`;
    const indexName = `${capitalize(fieldName)}_by_${modelName}`;
    const values = (this.options.sort || ['ts']).map<IndexValue>(field => {
      const isReversed = field.startsWith('-');
      const fieldName = isReversed ? field.substring(1) : field;
      return { field: fieldName === 'ts' || fieldName === 'ref' ? [fieldName] : ['data', fieldName], reverse: isReversed };
    });

    const queries = [
      q.CreateIndex({
        name: indexName,
        source: q.Collection(tertiaryTable),
        terms: [{ field: ['data', fromField] }],
        values: values.concat([{field: ['data', toField]}]),
      }),
    ]
    if (this.options.reverse) {
      queries.push(q.CreateIndex({
        name: `${capitalize(this.options.reverse)}_by_${capitalize(toField)}`,
        source: q.Collection(tertiaryTable),
        terms: [{field: ['data', toField]}],
        values: values.concat([{ field: ['data', fromField] }]),
      }));
    }
    return queries
  }
}
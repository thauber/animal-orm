import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { Field, IndexedFieldOptions, IndexValue } from './Field';
import { capitalize, depluralize } from './utils';
import { EmittedFieldSchema, Model, ModelFieldSet, ParseOptions } from './Model';



type y = z.ZodTypeDef

export class ManyToManyField<M extends ModelFieldSet> extends Field<z.ZodNever, z.ZodObject<EmittedFieldSchema<M>>> {
  readonly options: IndexedFieldOptions;
  readonly model: Model<M>;

  constructor(model:Model<M>, options: IndexedFieldOptions = {}) {
    super([z.never(),model.emit], options);
    this.model = model;
    this.options = options;
  }

  query(modelName: string, fieldName: string):Expr {
    const indexName = `${capitalize(fieldName)}_by_${modelName}`;

    return this.model.zoo.paginateQuery(indexName)
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
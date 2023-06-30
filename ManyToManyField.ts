import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { Field, IndexedFieldOptions, IndexValue } from './Field';
import { decapitalize, capitalize, depluralize } from './utils';
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

  getTertiaryTableName(modelName: string, fieldName: string) {
    const singularizedField = this.options.singular || depluralize(fieldName)
    return `${modelName}${capitalize(singularizedField)}`;
  }

  getIndexName(modelName: string, fieldName: string) {
    return `${fieldName}_by_${decapitalize(modelName)}`;
  }

  getReverseIndexName(fieldName: string) {
    if (this.options.reverse) {
      const singularizedField = this.options.singular || depluralize(fieldName)
      return `${this.options.reverse}_by_${singularizedField}`
    }
    return null;
  }

  deconstruct(modelName: string, fieldName: string) {
    const queries = [
      q.Delete(q.Collection(this.getTertiaryTableName(modelName, fieldName))),
      q.Delete(q.Index(this.getIndexName(modelName, fieldName))),
    ]
    const reverseIndexName = this.getReverseIndexName(fieldName)
    if (reverseIndexName) {
      queries.push(q.Delete(q.Index(reverseIndexName)))
    }
    return queries
  }

  construct(modelName: string, fieldName: string) {
    const singularizedField = this.options.singular || depluralize(fieldName)
    const singularizedModel = modelName.toLowerCase()
    const tertiaryTable = this.getTertiaryTableName(modelName, fieldName)

    //Create the value tuples base on the sorting options
    const values = (this.options.sort || ['ts']).map<IndexValue>(field => {
      const isReversed = field.startsWith('-');
      const fieldName = isReversed ? field.substring(1) : field;
      return { field: fieldName === 'ts' || fieldName === 'ref' ? [fieldName] : ['data', fieldName], reverse: isReversed };
    });

    const tables = [
      q.CreateCollection({ name: tertiaryTable }),
    ]
    const indexes = [
      q.CreateIndex({
        name: this.getIndexName(modelName, fieldName),
        source: q.Collection(tertiaryTable),
        terms: [{ field: ['data', singularizedModel] }],
        values: values.concat([{field: ['data', singularizedField]}]),
      }),
    ]
    if (this.options.reverse) {
      indexes.push(q.CreateIndex({
        name: this.getReverseIndexName(fieldName),
        source: q.Collection(tertiaryTable),
        terms: [{field: ['data', singularizedField]}],
        values: values.concat([{ field: ['data', singularizedModel] }]),
      }));
    }
    return {tables, indexes}
  }
}
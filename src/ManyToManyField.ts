import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { IndexedFieldOptions, IndexValue } from './RefField';
import { Field } from './Field';
import { depluralize } from './utils';
import { EmittedFieldSchema, Model, ModelFieldSet, ParseOptions } from './Model';


export interface ManyToManyFieldOptions extends IndexedFieldOptions {
  forwardIndexName?: string;
  tertiaryTableName?: string;
}

export class ManyToManyField<M extends ModelFieldSet> extends Field<z.ZodNever, z.ZodObject<EmittedFieldSchema<M>>> {
  readonly options: ManyToManyFieldOptions;
  readonly model: Model<M>;

  constructor(model:Model<M>, options: ManyToManyFieldOptions = {}) {
    super([z.never(),model.emit], options);
    this.model = model;
    this.options = options;
  }

  query(modelName: string, fieldName: string):Expr {
    return this.model.zoo.paginateQuery(this.getForwardIndexName(modelName, fieldName))
  }

  getTertiaryTableName(modelName: string, fieldName: string) {
    return this.options.tertiaryTableName || `${modelName}_${fieldName}`;
  }

  getForwardIndexName(modelName: string, fieldName: string) {
    return this.options.forwardIndexName || `${fieldName}_by_${modelName}`;
  }

  getReverseIndexName(fieldName: string) {
    if (this.options.reverse) {
      return `${this.options.reverse}_by_${fieldName}`
    }
    return null;
  }

  deconstruct(modelName: string, fieldName: string) {
    const queries = [
      q.Delete(q.Collection(this.getTertiaryTableName(modelName, fieldName))),
      q.Delete(q.Index(this.getForwardIndexName(modelName, fieldName))),
    ]
    const reverseIndexName = this.getReverseIndexName(fieldName)
    if (reverseIndexName) {
      queries.push(q.Delete(q.Index(reverseIndexName)))
    }
    return queries
  }

  index(modelName: string, fieldName: string) {
    const tertiaryTable = this.getTertiaryTableName(modelName, fieldName)
    const values = (this.options.sort || ['ts']).map<IndexValue>(field => {
      const isReversed = field.startsWith('-');
      const fieldName = isReversed ? field.substring(1) : field;
      return { field: fieldName === 'ts' || fieldName === 'ref' ? [fieldName] : ['data', fieldName], reverse: isReversed };
    });

    const indexes = [
      q.CreateIndex({
        name: this.getForwardIndexName(modelName, fieldName),
        source: q.Collection(tertiaryTable),
        terms: [{ field: ['data', `${modelName}_ref`] }],
        values: values.concat([{field: ['data', `${fieldName}_ref`]}]),
      }),
    ]
    if (this.options.reverse) {
      indexes.push(q.CreateIndex({
        name: this.getReverseIndexName(fieldName),
        source: q.Collection(tertiaryTable),
        terms: [{field: ['data', `${fieldName}_ref`]}],
        values: values.concat([{ field: ['data', `${modelName}_ref`] }]),
      }));
    }
    return indexes
  }

  construct(modelName: string, fieldName: string) {
    return [
      q.CreateCollection({ name: this.getTertiaryTableName(modelName, fieldName) }),
    ]
  }
}
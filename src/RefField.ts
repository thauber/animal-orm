import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { Field, FieldOptions } from './Field';
import { EmittedFieldObject, EmittedFieldSchema, Model, ModelFieldSet } from './Model';
import { IndexValue } from './Field';
import { sortToValues } from './utils';

export interface IndexedFieldOptions extends FieldOptions {
  sort?: string[];
  reverse?: string;
  reverseIndexName?: string;
}

export class RefField<M extends ModelFieldSet> extends Field<z.ZodEffects<z.ZodString, Expr, string>, z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M, EmittedFieldSchema<M>>>> {
  readonly model: Model<M>;
  readonly options: IndexedFieldOptions;

  constructor(model:Model<M>, options:IndexedFieldOptions = {}) {
    super([z.string().transform((id:string)=>model.zoo.refFromId(id)), model.emit], options);
    this.model = model;
    this.options = options;
  }

  getReverseIndexName(fieldName: string) {
    if (this.options.reverse) {
      return this.options.reverseIndexName || `${this.options.reverse}_by_${fieldName}`
    }
    return null;
  }

  deconstruct(modelName: string, fieldName: string) {
    const reverseIndexName = this.getReverseIndexName(fieldName)
    if (reverseIndexName) {
      return [
        q.Delete(q.Index(reverseIndexName)),
      ]
    }
    return [];
  }

  index(modelName: string, fieldName: string) {
    const reverseIndexName = this.getReverseIndexName(fieldName)
    if (reverseIndexName) {
      const values = sortToValues(this.options.sort).concat([{field: ['ref']}]);

      return [
        q.CreateIndex({
          name: reverseIndexName,
          source: q.Collection(modelName),
          terms: [{ field: ['data', fieldName] }],
          values: values,
        }),
      ];
    }
    return []
  }

  query(_modelName:string, fieldName: string) {
    return this.model.zoo.dereferenceQuery(q.Select(['data', fieldName], q.Var('document')));
  }
}
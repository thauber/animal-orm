import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { Field, FieldOptions } from './Field';
import { EmittedFieldSchema, Model, ModelFieldSet } from './Model';

export interface IndexedFieldOptions extends FieldOptions {
  sort?: string[];
  reverse?: string;
  reverseIndexName?: string;
}

export interface IndexValue {
  field: string[],
  reverse?: boolean,
}

export class RefField<M extends ModelFieldSet> extends Field<z.ZodEffects<z.ZodString, Expr, string>, z.ZodObject<EmittedFieldSchema<M>>> {
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
      const values = (this.options.sort || ['-ts']).map<IndexValue>(field => {
        const isReversed = field.startsWith('-');
        const fieldName = isReversed ? field.substring(1) : field;
        return { field: fieldName === 'ts' || fieldName === 'ref' ? [fieldName] : ['data', fieldName], reverse: isReversed };
      }).concat([{field: ['ref']}]);

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
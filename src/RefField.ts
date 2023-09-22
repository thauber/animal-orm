import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { EmittedFieldObject, EmittedFieldSchema, Model, ModelFieldSet } from './Model';
import { sortToValues } from './utils';
import ReversibleField, { ReverseName, ReversibleFieldOptions } from './ReversibleField';
import { ReverseField } from './ReverseField';

export interface IndexedFieldOptions extends ReversibleFieldOptions {
  sort?: string[];
}

export class RefField<M extends ModelFieldSet> extends ReversibleField<z.ZodEffects<z.ZodString, Expr, string>, z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M>>, M> {
  readonly model: Model<M>;
  readonly options: IndexedFieldOptions;

  constructor(model:Model<M>, options:IndexedFieldOptions = {})  {
    super(model, [z.string().transform((id:string)=>model.zoo.refFromId(id)), model.emit], options);
    this.model = model;
    this.options = options;
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
    if (typeof this.options.reverse === 'string') {
      const reverseIndexName = this.getReverseIndexName(fieldName)
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
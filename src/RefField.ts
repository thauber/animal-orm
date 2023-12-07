import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { EmittedFieldObject, EmittedFieldSchema, Model, ModelFieldSet } from './Model';
import { sortToValues } from './utils';
import ReversibleField, { ReverseName, ReversibleFieldOptions } from './ReversibleField';

export interface IndexedFieldOptions extends ReversibleFieldOptions {
  sort?: string[];
}

//We need a base class so that RefField and RefFieldOptional can have different admit types using super
class BaseRefField<A extends z.ZodTypeAny, E extends z.ZodTypeAny, M extends ModelFieldSet> extends ReversibleField<A, E, M> {
  readonly model: Model<M>;
  readonly options: IndexedFieldOptions;

  constructor(model: Model<M>, schema: A | E | [A,E], options: IndexedFieldOptions = {}) {
    super(model, schema, options);
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
    const indexes = super.index(modelName, fieldName);
    if (typeof this.options.reverse === 'string') {
      const reverseIndexName = this.getReverseIndexName(fieldName)
      const values = sortToValues(this.options.sort).concat([{field: ['ref']}]);

      indexes.push(
        q.CreateIndex({
          name: reverseIndexName,
          source: q.Collection(modelName),
          terms: [{ field: ['data', fieldName] }],
          values: values,
        }),
      );
    }
    return indexes
  }

}

export class RefFieldOptional<M extends ModelFieldSet> extends BaseRefField<z.ZodEffects<z.ZodOptional<z.ZodString>, Expr | undefined, string | undefined>, z.ZodOptional<z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M>>>, M> {
  constructor(model:Model<M>, options:IndexedFieldOptions = {})  {
    super(model, [z.optional(z.string()).transform((id:string | undefined)=> id ? model.zoo.refFromId(id) : undefined), z.optional(model.emit)], options);
  }

  query(_modelName:string, fieldName: string) {
    return q.If(q.ContainsPath(['data', fieldName], q.Var("document")), this.model.zoo.dereferenceQuery(q.Select(['data', fieldName], q.Var('document'))), null)
  }
}

export class RefField<M extends ModelFieldSet> extends BaseRefField<z.ZodEffects<z.ZodString, Expr, string>, z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M>>, M> {
  static optional = RefFieldOptional;

  constructor(model:Model<M>, options:IndexedFieldOptions = {})  {
    super(model, [z.string().transform((id:string)=>model.zoo.refFromId(id)), model.emit], options);
  }

  query(_modelName:string, fieldName: string) {
    return this.model.zoo.dereferenceQuery(q.Select(['data', fieldName], q.Var('document')));
  }
}

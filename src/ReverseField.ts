import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import ReversibleField from './ReversibleField';
import { Field } from './Field';
import { EmittedFieldObject, EmittedFieldSchema, Model, ModelFieldSet } from './Model';

export class ReverseField<M extends ModelFieldSet> extends Field<z.ZodUndefined, z.ZodArray<z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M>>>> {
  readonly model: Model<M>;
  readonly reversedField: ReversibleField<any, any, M>;
  readonly reversedFieldName: string;

  constructor(model:Model<M>, reversedFieldName: string, reversedField: ReversibleField<any, any, M>) {
    super([z.undefined(), z.array(model.emit)]);
    this.model = model;
    this.reversedField = reversedField;
    this.reversedFieldName = reversedFieldName;
  }

  path(_fieldName: string) {
    return null
  }

  query(_modelName: string, _fieldName: string):Expr {
    return this.model.zoo.paginateQuery(this.reversedField.getReverseIndexName(this.reversedFieldName), [q.Var("ref")])
  }
}
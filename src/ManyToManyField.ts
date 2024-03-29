import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { IndexedFieldOptions } from './RefField';
import { sortToValues } from './utils';
import { EmittedFieldObject, EmittedFieldSchema, Model, ModelFieldSet, ParseOptions } from './Model';
import ReversibleField, { ReverseName } from './ReversibleField';


export interface ManyToManyFieldOptions extends IndexedFieldOptions {
  forwardIndexName?: string;
  tertiaryTableName?: string;
}

  export class ManyToManyField<M extends ModelFieldSet> extends ReversibleField<z.ZodNever, z.ZodArray<z.ZodObject<EmittedFieldSchema<M>, any, any, EmittedFieldObject<M>>>, M> {
  readonly options: ManyToManyFieldOptions;
  readonly model: Model<M>;

  constructor(model:Model<M>, options: ManyToManyFieldOptions = {}) {
    super(model, [z.never(), z.array(model.emit)], options);
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
    const values = sortToValues(this.options.sort)

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
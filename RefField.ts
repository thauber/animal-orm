import * as z from 'zod';
import { query as q } from 'faunadb';
import { Field, IndexValue, IndexedFieldOptions } from './Field';
import { EmittedFieldSchema, Model, ModelFieldSet, ParseOptions } from './Model';
import { capitalize } from './utils';

type EmitRelated<M extends ModelFieldSet, MM extends Model<M>> = MM['emit']

export class RefField<M extends ModelFieldSet> extends Field<z.ZodString, z.ZodObject<EmittedFieldSchema<M>>> {
  readonly model: Model<M>;
  readonly options: IndexedFieldOptions;

  constructor(model:Model<M>, options:IndexedFieldOptions) {
    super([z.string(), model.emit], options);
    this.model = model;
    this.options = options;
  }

  construct(modelName: string, fieldName: string) {
    if (this.options.reverse) {
      const indexName = `${capitalize(this.options.reverse)}_by_${capitalize(fieldName)}`;
      const values = (this.options.sort || []).map<IndexValue>(field => {
        const isReversed = field.startsWith('-');
        const fieldName = isReversed ? field.substring(1) : field;
        return { field: fieldName === 'ts' || fieldName === 'ref' ? [fieldName] : ['data', fieldName], reverse: isReversed };
      }).concat([{field: ['ref']}]);

      return [
      q.CreateIndex({
        name: indexName,
        source: q.Collection(modelName),
        terms: [{ field: ['data', fieldName] }],
        values: values,
      }),
      ];
    }
    return [];
  }

  query(fieldName: string) {
    return this.model.zoo.dereference(q.Select(['data', fieldName], q.Var('document')));
  }
}
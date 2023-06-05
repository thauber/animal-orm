import * as z from 'zod';
import { query as q } from 'faunadb';
import { Field, IndexValue, IndexedFieldOptions } from './Field';
import { Model, ParseOptions } from './Model';
import { capitalize } from './utils';

export class ForeignKeyField extends Field {
  readonly model: Model;
  readonly options: IndexedFieldOptions;

  constructor(model:Model, options:IndexedFieldOptions) {
    super(model.schema());
    this.model = model;
    this.options = options;

  }

  schema(options:ParseOptions) {
    return this.model.schema(options)
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
    return q.Let({
      ref: q.Select(['data', fieldName], q.Var('document'))
    }, {
      [fieldName]: q.Get(q.Var('ref'))
    });
  }

}
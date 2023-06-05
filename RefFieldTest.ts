import { ForeignKeyField } from './ForeignKeyField';
import { Field, IndexedFieldOptions } from './Field';
import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import { Model, ParseOptions } from './Model';

// Mocking your Model class
class MockModel extends Model {
  schema(options:ParseOptions) {
    return z.string();
  }

  dereference(ref:Expr) {
    return q.Get(ref);
  }
}

describe('ForeignKeyField', () => {
  let field: ForeignKeyField;
  let options: IndexedFieldOptions;
  let model: Model;

  beforeEach(() => {
    options = {
      reverse: 'adminJobs',
      sort: ['-ts']
    };
    model = new MockModel('User', { email: new Field(z.string()) });
    field = new ForeignKeyField(model, options);
  });

  describe('query', () => {
    it('returns a valid FQL query', () => {
      const query = field.query('testField');
      expect(query).toEqual(
        q.Let({
          ref: q.Select(['data', 'testField'], q.Var('document'))
        }, {
          testField: q.Get(q.Var('ref'))
        })
      );
    });
  });

  describe('construct', () => {
    it('returns a valid FQL query for index creation', () => {
      const constructs = field.construct('Job', 'admin');
      expect(constructs).toHaveLength(1);
      expect(constructs[0]).toEqual(
        q.CreateIndex({
          name: 'AdminJobs_by_Admin',
          source: q.Collection('Job'),
          terms: [{ field: ['data', 'admin'] }],
          values: [{ field: ['ts'], reverse: true }, {field: ['ref']}],
        })
      );
    });

    it('returns an empty array when options.reverse is not provided', () => {
      field = new ForeignKeyField(model, { sort: ['-ts'] });
      const constructs = field.construct('TestModel', 'testField');
      expect(constructs).toHaveLength(0);
    });
  });
});

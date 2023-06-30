import { RefField } from './RefField';
import { Field, IndexedFieldOptions } from './Field';
import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import { Model } from './Model';

const fields = { email: new Field(z.string()) }
const originalEnv = { ...process.env };

describe('RefField', () => {
  let field: RefField<typeof fields>;
  let options: IndexedFieldOptions;
  let model: Model<typeof fields>;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      FAUNADB_SECRET_KEY: 'secret',
    };
    options = {
      reverse: 'adminJobs',
      sort: ['-ts']
    };
    model = new Model('User', fields);
    field = new RefField(model, options);
  });

  describe('query', () => {
    it('returns a valid FQL query', () => {
      const query = field.query('_doesntMatter', 'testField');
      expect(query).toEqual(
        model.zoo.dereference(q.Select(['data', 'testField'], q.Var('document')))
      );
    });
  });

  describe('construct', () => {
    it('returns a valid FQL query for index creation', () => {
      const {indexes} = field.construct('Job', 'admin');
      expect(indexes).toHaveLength(1);
      expect(indexes && indexes[0]).toEqual(
        q.CreateIndex({
          name: 'adminJobs_by_admin',
          source: q.Collection('Job'),
          terms: [{ field: ['data', 'admin'] }],
          values: [{ field: ['ts'], reverse: true }, {field: ['ref']}],
        })
      );
    });

    it('returns an empty array when options.reverse is not provided', () => {
      field = new RefField(model, { sort: ['-ts'] });
      const constructs = field.construct('TestModel', 'testField');
      expect(constructs.indexes).toBeUndefined();
      expect(constructs.tables).toBeUndefined();
    });
  });
});

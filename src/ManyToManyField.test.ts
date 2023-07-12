import { ManyToManyField, ManyToManyFieldOptions } from './ManyToManyField';
import { Expr, query as q } from 'faunadb';
import { Model, ParseOptions } from './Model';
import { Field } from './Field';
import * as z from 'zod';

// Mocking your Model class
const fields = { email: new Field(z.string()) }
const originalEnv = { ...process.env };


describe('ManyToManyField', () => {
  let model:Model<typeof fields>;
  let field: ManyToManyField<typeof fields>;
  let options: ManyToManyFieldOptions;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      FAUNADB_SECRET_KEY: 'secret',
    };
    model = new Model('User', { email: new Field(z.string()) });
    options = {
      reverse: 'jobs',
      sort: ['-ts']
    };
    field = new ManyToManyField(model, options);
  });

  describe('query', () => {
    it('returns a valid FQL query', () => {
      const query = field.query('jobs', 'volunteers');
      expect(query).toEqual(
        model.zoo.paginateQuery('volunteers_by_jobs')
      );
    });
  });

  describe('construct', () => {
    it('returns a valid FQL query for index creation', () => {
      const constructs = field.construct('jobs', 'volunteers');
      expect(constructs).toHaveLength(1);
      expect(constructs[0]).toEqual(
        q.CreateCollection({ name: 'jobs_volunteers' })
      );
      const indexes = field.index('jobs', 'volunteers');
      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toEqual(
        q.CreateIndex({
          name: 'volunteers_by_jobs',
          source: q.Collection('jobs_volunteers'),
          terms: [{ field: ['data', 'jobs_ref'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'volunteers_ref'] }]
        })
      );
      expect(indexes[1]).toEqual(
        q.CreateIndex({
          name: 'jobs_by_volunteers',
          source: q.Collection('jobs_volunteers'),
          terms: [{ field: ['data', 'volunteers_ref'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'jobs_ref'] }]
        })
      );
    });
  });
});

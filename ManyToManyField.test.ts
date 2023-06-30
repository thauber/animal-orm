import { ManyToManyField } from './ManyToManyField';
import { Expr, query as q } from 'faunadb';
import { Model, ParseOptions } from './Model';
import { Field, IndexedFieldOptions } from './Field';
import * as z from 'zod';

// Mocking your Model class
const fields = { email: new Field(z.string()) }
const originalEnv = { ...process.env };


describe('ManyToManyField', () => {
  let model:Model<typeof fields>;
  let field: ManyToManyField<typeof fields>;
  let options: IndexedFieldOptions;

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
      const query = field.query('Job', 'volunteers');
      expect(query).toEqual(
        model.zoo.paginateQuery('Volunteers_by_Job')
      );
    });
  });

  describe('construct', () => {
    it('returns a valid FQL query for index creation', () => {
      const constructs = field.construct('Job', 'volunteers');
      expect(constructs.indexes||[]).toHaveLength(2);
      expect(constructs.tables||[]).toHaveLength(1);
      expect(constructs.tables[0]).toEqual(
        q.CreateCollection({ name: 'JobVolunteer' })
      );
      expect(constructs.indexes[0]).toEqual(
        q.CreateIndex({
          name: 'volunteers_by_job',
          source: q.Collection('JobVolunteer'),
          terms: [{ field: ['data', 'job'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'volunteer'] }]
        })
      );
      expect(constructs.indexes[1]).toEqual(
        q.CreateIndex({
          name: 'jobs_by_volunteer',
          source: q.Collection('JobVolunteer'),
          terms: [{ field: ['data', 'volunteer'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'job'] }]
        })
      );
    });
  });
});

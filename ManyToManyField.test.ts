import { ManyToManyField } from './ManyToManyField';
import { Expr, query as q } from 'faunadb';
import { Model, ParseOptions } from './Model';
import { Field, IndexedFieldOptions } from './Field';
import * as z from 'zod';

// Mocking your Model class
class MockModel extends Model {
  schema(options:ParseOptions) {
    return z.string();
  }

  dereference(ref:Expr) {
    return q.Get(ref);
  }
}

describe('ManyToManyField', () => {
  let model:MockModel;
  let field: ManyToManyField;
  let options: IndexedFieldOptions;

  beforeEach(() => {
    model = new MockModel('User', { email: new Field(z.string()) });
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
        q.Select(
          "data",
          q.Map(
            q.Paginate(q.Match(q.Index('Volunteers_by_Job'), q.Var('ref'))),
            q.Lambda(
              'values', 
              model.dereference(
                q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')))
              )
          )
        )
      );
    });
  });

  describe('construct', () => {
    it('returns a valid FQL query for index creation', () => {
      const constructs = field.construct('Job', 'volunteers');
      expect(constructs).toHaveLength(2);
      expect(constructs[0]).toEqual(
        q.CreateIndex({
          name: 'Volunteers_by_Job',
          source: q.Collection('JobVolunteer'),
          terms: [{ field: ['data', 'job'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'volunteer'] }]
        })
      );
      expect(constructs[1]).toEqual(
        q.CreateIndex({
          name: 'Jobs_by_Volunteer',
          source: q.Collection('JobVolunteer'),
          terms: [{ field: ['data', 'volunteer'] }],
          values: [{ field: ['ts'], reverse: true }, { field: ['data', 'job'] }]
        })
      );
    });
  });

  describe('schema', () => {
    it('returns model schema', () => {
      const schema = field.schema();
      expect(typeof schema).toEqual(typeof z.string());
    });
  });
});

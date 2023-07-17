import { Field } from './Field';
import { query as q } from 'faunadb';
import * as z from 'zod';
import { sortToValues } from './utils';

const fields = { email: new Field(z.string()) }
const originalEnv = { ...process.env };

describe('Field', () => {
  let field: Field<z.ZodString>;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      FAUNADB_SECRET_KEY: 'secret',
    };
    field = new Field(z.string());
  });

  describe('query', () => {
    it('returns a valid FQL query', () => {
      const query = field.query('_doesntMatter', 'testField');
      expect(query).toEqual(
        q.Select(['data', 'testField'], q.Var('document'), null)
      );
    });
  });

  describe('sortToValues', () => {
    it('returns a valid list of IndexValues', () => {
      const values = sortToValues(['-ts', '-name'])
      expect(values).toEqual([
        {field: ['ts'], reverse: true},
        {field: ['data', 'name'], reverse: true},
      ])
    })
  })

  describe('index', () => {
    it('returns no indexes without unique or indexed option', () => {
      const indexes = field.index('Job', 'admin');
      expect(indexes).toHaveLength(0);
    });

    it('returns one unique indexes with unique', () => {
      field = new Field(z.string(), { unique: true })
      const constructs = field.construct('TestModel', 'testField');
      expect(constructs).toHaveLength(0);
      const indexes = field.index('TestModel', 'testField');
      expect(indexes).toHaveLength(1);
      expect(indexes && indexes[0]).toEqual(
        q.CreateIndex({
          name: 'TestModel_by_testField',
          source: q.Collection('TestModel'),
          terms: [{ field: ['data', 'testField'] }],
          unique: true,
          values: [
            {field: ['ts'], reverse: true},
            {field: ['ref']}
          ],
        })
      )
    });
    it('returns one sorted index with indexed', () => {
      field = new Field(z.string(), { indexed: ['-ts', '-name'] })
      const constructs = field.construct('TestModel', 'testField');
      expect(constructs).toHaveLength(0);
      const indexes = field.index('TestModel', 'testField');
      expect(indexes).toHaveLength(1);
      expect(indexes && indexes[0]).toEqual(
        q.CreateIndex({
          name: 'TestModel_by_testField',
          source: q.Collection('TestModel'),
          terms: [{ field: ['data', 'testField'] }],
          unique: false,
          values: [
            {field: ['ts'], reverse: true},
            {field: ['data', 'name'], reverse: true},
            {field: ['ref']}
          ],
        })
      )
    });
    it('returns one sorted index with indexed', () => {
      field = new Field(z.string(), { indexed: true })
      const constructs = field.construct('TestModel', 'testField');
      expect(constructs).toHaveLength(0);
      const indexes = field.index('TestModel', 'testField');
      expect(indexes).toHaveLength(1);
      expect(indexes && indexes[0]).toEqual(
        q.CreateIndex({
          name: 'TestModel_by_testField',
          source: q.Collection('TestModel'),
          terms: [{ field: ['data', 'testField'] }],
          unique: false,
          values: [
            {field: ['ts'], reverse: true},
            {field: ['ref']}
          ],
        })
      )
    });
  });
});

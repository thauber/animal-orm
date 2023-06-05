import { Model, ParseOptions } from './Model';
import { Field } from './Field';
import * as z from 'zod';
import { query as q, Expr } from 'faunadb';

describe('Model', () => {
  let model: Model;
  const schema = {
    name: new Field(z.string(), {}),
    age: new Field(z.number(), {}),
  };
  beforeEach(() => {
    model = new Model('User', schema);
  });

  it('constructs correctly', () => {
    const result = model.construct();
    expect(result).toEqual(q.Do(
      q.CreateCollection({ name: 'User' }),
    ));
  });

  it('creates the right schema without options', () => {
    const zodSchema = model.schema();
    expect(zodSchema.safeParse({ name: 'Alice', age: 25 }).success).toBeTruthy();
    expect(zodSchema.safeParse({ name: 'Alice', age: '25' }).success).toBeFalsy();
  });

  it('creates the right schema with options', () => {
    const options: ParseOptions = {
      showHidden: true,
      hideTertiaryRelations: true,
    };
    const zodSchema = model.schema(options);
    expect(zodSchema.safeParse({ name: 'Alice', age: 25 }).success).toBeTruthy();
    expect(zodSchema.safeParse({ name: 'Alice', age: '25' }).success).toBeFalsy();
  });

  it('dereferences correctly', () => {
    const ref: Expr = q.Ref(q.Collection('User'), '1234');
    const result = model.dereference(ref);
    expect(result).toEqual(q.Let({
      ref: ref,
      document: q.Get(ref),
    }, {
      name: schema.name.query('User', 'name'),
      age: schema.age.query('User', 'age'),
    }));
  });

  it('queries correctly', () => {
    const result = model.query('1234');
    expect(result).toEqual(model.dereference(q.Ref(q.Collection('User'), '1234')));
  });
});
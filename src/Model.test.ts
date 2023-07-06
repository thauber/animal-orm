import { Model, ParseOptions } from './Model';
import { Field } from './Field';
import * as z from 'zod';
import { query as q, Expr } from 'faunadb';
import a from './a'

const mockRef = q.Ref(q.Collection('User'), 'id123')

let response:object = {
  name: 'john smith',
  age: 25,
  password: 'hello',
  ref: mockRef,
  ts: 234123123123
};
jest.mock('faunadb', () => ({
  ...jest.requireActual('faunadb'),
  Client: jest.fn().mockImplementation(()=>({
    query: jest.fn((...args) => {
      return response
    })
  }))
}))

const originalEnv = { ...process.env };
const fields = {
  name: new Field(z.string()),
  password: new Field([z.string(), a.hidden()]),
  age: new Field(z.number()),
}
    
let model:Model<typeof fields>;

describe('Model', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      FAUNADB_SECRET_KEY: 'secret',
    };
    model = new Model('User', fields)
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('constructs correctly', () => {
    const result = model.construct();
    expect(result.tables).toEqual(q.Do(
      q.CreateCollection({ name: 'User' }),
    ));
  });

  it('creates the right schema while emitting', () => {
    const zodSchema = model.emit;
    expect(zodSchema.safeParse(response).success).toBeTruthy();
    expect(zodSchema.safeParse({...response, age:'25'}).success).toBeFalsy();
  });

  it('creates the right schema while admitting', () => {
    const options: ParseOptions = {
      showHidden: true,
      hideTertiaryRelations: true,
    };
    const zodSchema = model.admit;
    expect(zodSchema.safeParse({ name: 'Alice', age: 25, password:"hello" }).success).toBeTruthy();
    expect(zodSchema.safeParse({ name: 'Alice', age: '25', password:"hello" }).success).toBeFalsy();
  });

  describe(".zoo", () => {
    describe('.paginate()', () => {
      it('should call the query method with the paginateQuery result', async () => {
        const terms = ['term1', 'term2'];
        const query = model.zoo.paginateQuery('index123', terms);
        ;(model.zoo.client.query as jest.Mock).mockResolvedValueOnce([response, response]);
        await model.zoo.paginate('index123', terms);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.get()', () => {
      it('should call the query method with the getQuery result', async () => {
        const query = model.zoo.getQuery(mockRef);
        await model.zoo.get(mockRef);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.create()', () => {
      it('should call the query method with the createQuery result', async () => {
        const data = { name: 'John', password: 'pass123', age: 30 };
        const query = model.zoo.createQuery(data);
        await model.zoo.create(data);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.update()', () => {
      it('should call the query method with the updateQuery result', async () => {
        const data = { name: 'John', password: 'pass123', age: 30 };
        const query = model.zoo.updateQuery(mockRef, data);
        await model.zoo.update(mockRef, data);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.delete()', () => {
      it('should call the query method with the deleteQuery result', async () => {
        const query = model.zoo.deleteQuery(mockRef);
        await model.zoo.delete(mockRef);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.dereference()', () => {
      it('should return a Let query with a ref and document', () => {
        const query = model.zoo.dereference(mockRef);
        const expected = q.Let(
          {
            ref: mockRef,
            document: q.Get(mockRef)
          },
          q.Merge(
            {
              ref: q.Select(['ref'], q.Var('document')),
              ts: q.Select(['ts'], q.Var('document')),
              name: fields.name.query(model.name, 'name'),
              password: fields.password.query(model.name, 'password'),
              age: fields.age.query(model.name, 'age'),
            },{
              ref: ['ref'],
              ts: ['ts'],
              name: ['data', 'name'],
              password: ['data', 'password'],
              age: ['data', 'age'],
            },
            q.Lambda(['key', 'a', 'b'], q.If(q.ContainsPath(q.Var("b"), q.Var("document")), q.Var("a"), null))
          )
        );
        expect(query).toEqual(expected);
      });
    });

    describe('.paginateQuery()', () => {
      it('should return a default index for paginating results if no index is given', () => {
        const query = model.zoo.paginateQuery();
        const expected = q.Select("data",
          q.Map(
            q.Paginate(q.Documents(q.Collection(model.name))),
            q.Lambda('values',
              q.Let(
                {
                  ref: q.Var('values')
                },
                model.zoo.dereference(q.Var('ref'))
              )
            )
          )
        );
        expect(query).toEqual(expected);
      });
      it('should return a Select query for paginating results', () => {
        const query = model.zoo.paginateQuery('index123', ['term1', 'term2']);
        const expected = q.Select("data",
          q.Map(
            q.Paginate(q.Match(q.Index('index123'), ['term1', 'term2'])),
            q.Lambda('values', q.Let(
              { ref: q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')) },
              model.zoo.dereference(q.Var('ref'))
            )),
          )
        );
        expect(query).toEqual(expected);
      });
    });

    describe('.getQuery()', () => {
      it('should return a dereference query for a specific id', () => {
        const query = model.zoo.getQuery(mockRef);
        const expected = model.zoo.dereference(mockRef);
        expect(query).toEqual(expected);
      });
    });

    describe('.createQuery()', () => {
      it('should return a Create query with validated data', () => {
        const data = { name: 'John', password: 'pass123', age: 30 };
        const query = model.zoo.createQuery(data);
        const expected = q.Create(q.Collection(model.name), { data });
        expect(query).toEqual(expected);
      });
    });

    describe('.updateQuery()', () => {
      it('should return an Update query with validated data', () => {
        const data = { name: 'John', password: 'pass123', age: 30 };
        const query = model.zoo.updateQuery(mockRef, data);
        const expected = q.Update(mockRef, { data });
        expect(query).toEqual(expected);
      });
    });

    describe('.deleteQuery()', () => {
      it('should return a Delete query for a specific id', () => {
        const query = model.zoo.deleteQuery(mockRef);
        const expected = q.Delete(mockRef);
        expect(query).toEqual(expected);
      });
    });

    it('can create an instance of the model', async () => {
      const data = {
        name: "John Smith",
        age: 25,
        password: "hello",
      }

      response = {
        ...data,
        ref: mockRef,
        ts: 2113123123123,
      }
 
      const result = await model.zoo.create(data);
      expect(result).toEqual({
        ...response,
        password: undefined,
      })
    });



  })

  describe("with a tertiary relation", () => {})
});
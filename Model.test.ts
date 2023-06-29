import { Model, ParseOptions } from './Model';
import { Field } from './Field';
import * as z from 'zod';
import { query as q, Expr } from 'faunadb';

// type Selection = Record<string, BaseQuery<any> | z.ZodType | [string, z.ZodType]>;

// type FromSelection<Sel extends Selection> = z.ZodObject<{
//   [K in keyof Sel]: Sel[K] extends BaseQuery<any> ? Sel[K]["schema"] : FromField<Sel[K]>;
// }>;

const a = {
  hidden: ():z.ZodEffects<z.ZodAny, void, any> => {return z.any().transform<void>((_a:any)=>{})}
}

let response:unknown = {
  name: 'john smith',
  age: 25,
  password: 'hello',
};
jest.mock('faunadb', () => ({
  ...jest.requireActual('faunadb'),
  Client: ()=>({
    query: jest.fn((...args) => {
      return response
    })
  })
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
    expect(result).toEqual(q.Do(
      q.CreateCollection({ name: 'User' }),
    ));
  });

  it('creates the right schema while emitting', () => {
    const zodSchema = model.emit;
    const result = zodSchema.parse({ name: 'Alice', age: 25, password:"hello" });
    expect(zodSchema.safeParse({ name: 'Alice', password:"hello", age: 25 }).success).toBeTruthy();
    expect(zodSchema.safeParse({ name: 'Alice', password:"hello", age: '25' }).success).toBeFalsy();
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
        const query = model.zoo.getQuery('id123');
        await model.zoo.get('id123');
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
        const query = model.zoo.updateQuery('id123', data);
        await model.zoo.update('id123', data);
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.delete()', () => {
      it('should call the query method with the deleteQuery result', async () => {
        const query = model.zoo.deleteQuery('id123');
        await model.zoo.delete('id123');
        expect(model.zoo.client.query).toHaveBeenCalledWith(query);
      });
    });

    describe('.dereference()', () => {
      it('should return a Let query with a ref and document', () => {
        const ref = q.Ref(q.Collection(model.name), 'id123');
        const query = model.zoo.dereference(ref);
        const expected = q.Let({
          ref: ref,
          document: q.Get(ref)
        }, {
          name: fields.name.query(model.name, 'name'),
          password: fields.password.query(model.name, 'password'),
          age: fields.age.query(model.name, 'age'),
        });
        expect(query).toEqual(expected);
      });
    });

    describe('.paginateQuery()', () => {
      it('should return a Select query for paginating results', () => {
        const query = model.zoo.paginateQuery('index123', ['term1', 'term2']);
        const expected = q.Select("data",
          q.Map(
            q.Paginate(q.Match(q.Index('index123'), ['term1', 'term2'])),
            q.Lambda('values', q.Let(
              { ref: q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')) },
              q.Let({
                ref: q.Var('ref'),
                document: q.Get(q.Var('ref'))
              }, {
                name: fields.name.query(model.name, 'name'),
                password: fields.password.query(model.name, 'password'),
                age: fields.age.query(model.name, 'age'),
              })
            )),
          )
        );
        expect(query).toEqual(expected);
      });
    });

    describe('.getQuery()', () => {
      it('should return a dereference query for a specific id', () => {
        const query = model.zoo.getQuery('id123');
        const ref = q.Ref(q.Collection(model.name), 'id123')
        const expected = q.Let({
          ref, 
          document: q.Get(ref)
        }, {
          name: fields.name.query(model.name, 'name'),
          password: fields.password.query(model.name, 'password'),
          age: fields.age.query(model.name, 'age'),
        });
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
        const query = model.zoo.updateQuery('id123', data);
        const expected = q.Update(q.Ref(q.Collection(model.name), 'id123'), { data });
        expect(query).toEqual(expected);
      });
    });

    describe('.deleteQuery()', () => {
      it('should return a Delete query for a specific id', () => {
        const query = model.zoo.deleteQuery('id123');
        const expected = q.Delete(q.Ref(q.Collection(model.name), 'id123'));
        expect(query).toEqual(expected);
      });
    });

    it('dereferences correctly', () => {
      const ref: Expr = q.Ref(q.Collection('User'), '1234');
      const result = model.zoo.dereference(ref);
      expect(result).toEqual(q.Let({
        ref: ref,
        document: q.Get(ref),
      }, {
        name: q.Select(['data', 'name'], q.Var('document')),
        age: q.Select(['data', 'age'], q.Var('document')),
        password: q.Select(['data', 'password'], q.Var('document')),
      }));
    });

    it('can create an instance of the model', async () => {
      const data = response = {
        name: "John Smith",
        age: 25,
        password: "hello",
      }
 
      const result = await model.zoo.create(data);
      expect(result).toEqual({
        name: "John Smith",
        age: 25,
        password: undefined,
      })
    });



  })

  describe("with a tertiary relation", () => {})
});
import { Client, query as q } from 'faunadb';
import { Model } from './Model';
import { Field } from './Field';
import * as z from 'zod';
import a from './a'
import { RefField } from './RefField';
import dotenv from "dotenv";
import { emit } from 'process';

dotenv.config();

// Mocking your Model class
const originalEnv = { ...process.env };

let client:Client;

process.env = {
  ...originalEnv,
  FAUNADB_SECRET_KEY: process.env.TEST_FAUNADB_SECRET_KEY,
};

describe('AnimalORM', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      FAUNADB_SECRET_KEY: process.env.TEST_FAUNADB_SECRET_KEY,
    };
    client = new Client({secret: process.env.FAUNADB_SECRET_KEY as string})
  })
  it('constructs and destructs properly', async () => {
    const User = new Model('User', {
      email: new Field(z.string()),
      password: new Field([z.string(), a.hidden()]),
    });

    const i = z.object({
      email: z.string().optional(),
    })

    const Job = new Model('Job', {
      title: new Field(z.string()),
      owner: new RefField(User, {reverse: "jobs"}),
    })

    await client.query(q.Do( User.construct(), Job.construct() ))
    await client.query(q.Do( User.index(), Job.index() ))
    await client.query(q.Do( Job.deconstruct(), User.deconstruct() ))
  })

  describe('Model', () => {
    const userFields = {
      email: new Field(z.string()),
      name: new Field(z.string().optional()),
      password: new Field([z.string(), a.hidden()]),
    }
    const jobFields = {
      title: new Field(z.string()),
      owner: new RefField(new Model("User", userFields), {reverse: "jobs"}),
    }

    let User:Model<typeof userFields>;
    let Job:Model<typeof jobFields>;
    beforeEach(async () => {
      User = new Model('User', userFields);
      Job = new Model('Job', jobFields);

      const user = User.construct();
      const job = Job.construct();
      await client.query(q.Do( User.construct(), Job.construct() ))
      await client.query(q.Do( User.index(), Job.index() ))
    })

    describe('.zoo', () => {
      it('can create a new insatnce', async () => {
        const userData = {
          email: "tiger@example.com",
          name: "Tony",
          password: "hello"
        } 
        const user = await User.zoo.create(userData)
        expect(user).toHaveProperty("id")
        expect(user).toHaveProperty("ts")
        expect(user.email).toBe("tiger@example.com")
        expect(user.name).toBe("Tony")
        expect(user.password).toBe(undefined)
      })
      it('can update an instance', async () => {
        const userData = {
          email: "tiger@example.com",
          name: "Tony",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now update the user
        const {ts, ...updatedUser} = await User.zoo.update(user.id, {email: "tiger+test@example.com"})
        expect(ts).toBeGreaterThan(user.ts)
        expect(updatedUser).toEqual({
          id: user.id,
          email: "tiger+test@example.com",
          name: "Tony",
          password: undefined,
        })
      })
      it('can get an instance', async () => {
        const userData = {
          email: "unicorn@example.com",
          name: "Tony",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now get the user
        const retrievedUser = await User.zoo.get(user.id)
        expect(retrievedUser).toEqual({
          id: user.id,
          ts: user.ts,
          email: "unicorn@example.com",
          name: "Tony",
          password: undefined,
        })
      })
      it('can get an instance missing optional fields', async () => {
        const userData = {
          email: "unicorn@example.com",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now get the user
        const retrievedUser = await User.zoo.get(user.id)
        expect(retrievedUser).toEqual({
          id: user.id,
          ts: user.ts,
          email: "unicorn@example.com",
          password: undefined,
        })
      })
      it('can delete an instance', async () => {
        const userData = {
          email: "tiger@example.com",
          name: "Tony",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now delete the user
        await User.zoo.delete(user.id)
        try {
          await User.zoo.get(user.id)
          //Should not get here
          expect(true).toBe(false)
        } catch (e) {
          expect((e as Error).message).toBe("instance not found")
        }
      })
      it('can create relationships', async () => {
        const userData = {
          email: "tiger@example.com",
          name: "Tony",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        const jobData = {
          title: "Software Engineer",
          name: "Tony",
          owner: user.id,
        }
        //now create a job for the user
        const job = await Job.zoo.create(jobData)
        expect(job.owner).toEqual(user);
      })
      it('can reverse relationships', async () => {
        const userData = {
          email: "tiger@example.com",
          name: "Tony",
          password: "hello",
        }

        //create a user
        const user = await User.zoo.create(userData)
        const jobData = {
          title: "Software Engineer",
          name: "Tony",
          owner: user.id,
        }

        //now create a job for the user
        const job = await Job.zoo.create(jobData)

        //now check the reverse relatioship
        const reverse = Job.fields.owner.getReverseIndexName('owner')
        expect(reverse).toBe("jobs_by_owner")
        if (reverse) {
          const jobs = await Job.zoo.paginate(reverse, [User.zoo.refFromId(user.id)])
          expect(jobs[0]).toEqual(job);
        }
      })
    });
    afterEach(async ()=> {
      await client.query(q.Do( Job.deconstruct(), User.deconstruct() ))
    })

  });
});
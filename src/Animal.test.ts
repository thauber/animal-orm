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
  it('constructs and destruts properly', async () => {
    const User = new Model('User', {
      email: new Field(z.string()),
      password: new Field([z.string(), a.hidden()]),
    });

    const Job = new Model('Job', {
      title: new Field(z.string()),
      owner: new RefField(User, {reverse: "jobs"}),
    })

    const user = User.construct();
    const job = Job.construct();
    await client.query(q.Do( user.tables, job.tables ))
    await client.query(q.Do( user.indexes, job.indexes ))
    await client.query(q.Do( Job.deconstruct(), User.deconstruct() ))
  })

  describe('Model', () => {
    const userFields = {
      email: new Field(z.string()),
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
      await client.query(q.Do( user.tables, job.tables ))
      await client.query(q.Do( user.indexes, job.indexes ))
    })

    describe('.zoo', () => {
      it('can create a new insatnce', async () => {
        const userData = {
          email: "tiger@example.com",
          password: "hello"
        } 
        const user = await User.zoo.create(userData)
        expect(user).toHaveProperty("ref")
        expect(user).toHaveProperty("ts")
        expect(user.email).toBe("tiger@example.com")
        expect(user.password).toBe(undefined)
      })
      it('can update an instance', async () => {
        const userData = {
          email: "tiger@example.com",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now update the user
        const {ts, ...updatedUser} = await User.zoo.update(user.ref, {email: "tiger+test@example.com"})
        expect(ts).toBeGreaterThan(user.ts)
        expect(updatedUser).toEqual({
          ref: user.ref,
          email: "tiger+test@example.com",
          password: undefined,
        })
      })
      it('can get an instance', async () => {
        const userData = {
          email: "unicorn@example.com",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now delete the user
        const retrievedUser = await User.zoo.get(user.ref)
        expect(retrievedUser).toEqual({
          ref: user.ref,
          ts: user.ts,
          email: "unicorn@example.com",
          password: undefined,
        })

      })
      it('can delete an instance', async () => {
        const userData = {
          email: "tiger@example.com",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        //now delete the user
        await User.zoo.delete(user.ref)
        try {
          await User.zoo.get(user.ref)
          //Should not get here
          expect(true).toBe(false)
        } catch (e) {
          expect((e as Error).message).toBe("instance not found")
        }
      })
      it('can create relationships', async () => {
        const userData = {
          email: "tiger@example.com",
          password: "hello",
        }
        const user = await User.zoo.create(userData)
        const jobData = {
          title: "Software Engineer",
          owner: user.ref,
        }
        //now create a job for the user
        const job = await Job.zoo.create(jobData)
        expect(job.owner).toEqual(user);
      })
      it('can reverse relationships', async () => {
        const userData = {
          email: "tiger@example.com",
          password: "hello",
        }

        //create a user
        const user = await User.zoo.create(userData)
        const jobData = {
          title: "Software Engineer",
          owner: user.ref,
        }

        //now create a job for the user
        const job = await Job.zoo.create(jobData)

        //now check the reverse relatioship
        const reverse = Job.fields.owner.getReverseIndexName('owner')
        expect(reverse).toBe("jobs_by_owner")
        if (reverse) {
          const jobs = await Job.zoo.paginate(reverse, [user.ref])
          expect(jobs[0]).toEqual(job);
        }
      })
    });
    afterEach(async  ()=> {
      await client.query(q.Do( Job.deconstruct(), User.deconstruct() ))
    })

  });
});
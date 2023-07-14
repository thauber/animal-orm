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
      describe("indexable fields", () => {
        const fields = {
          age: new Field(z.number()),
          type: new Field(z.enum(["Dog", "Cat", "Fish"]), {indexed: true}),
          name: new Field(z.string(), {indexed: ['-age']}),
          tagNumber: new Field(z.number(), {unique: true}),
        }
        let Pet:Model<typeof fields>;
        beforeEach(async () => {
          Pet = new Model('pets', fields)
          await client.query(Pet.construct())
          await client.query(Pet.index())
        })
        afterEach(async () => {
          await client.query(Pet.deconstruct())
        })
        it('can get an instance by index', async () => {
          const pet = await Pet.zoo.create({age: 5, type: "Dog", name: "Fido", tagNumber: 12345})
          const fetchedPet = await Pet.zoo.getBy('tagNumber', 12345)
          expect(pet.id === fetchedPet.id)
        })
        it('fails to generate two of the same document if they share a unique property', async () => {
          await Pet.zoo.create({age: 5, type: "Dog", name: "Fido", tagNumber: 12345})
          try {
            await Pet.zoo.create({age: 6, type: "Cat", name: "Tom", tagNumber: 12345})
            expect(false)
          } catch (e) {
            expect((e as Error).message).toBe("instance not unique")
          }

        })
        it('can paginate instances by index', async () => {
          const fido = await Pet.zoo.create({age: 5, type: "Dog", name: "Fido", tagNumber: 12345})
          const margaret = await Pet.zoo.create({age: 10, type: "Dog", name: "Margaret", tagNumber: 12346})
          //Add one that shouldn't return in the paginate
          await Pet.zoo.create({age: 2, type: "Cat", name: "Tom", tagNumber: 12347})
          const fetchedPets = await Pet.zoo.paginateBy('type', "Dog")
          expect(fetchedPets).toHaveLength(2)
          //sorted by the default -ts so most recent first
          expect(fetchedPets[0]).toEqual(margaret)
          expect(fetchedPets[1]).toEqual(fido)
        })
        it('can paginate instances by index', async () => {
          const older = await Pet.zoo.create({age: 15, type: "Dog", name: "Margaret", tagNumber: 12345})
          const younger = await Pet.zoo.create({age: 10, type: "Dog", name: "Margaret", tagNumber: 12346})
          //Add one that shouldn't return in the paginate
          await Pet.zoo.create({age: 2, type: "Cat", name: "Tom", tagNumber: 12347})
          const fetchedPets = await Pet.zoo.paginateBy('name', "Margaret")
          expect(fetchedPets).toHaveLength(2)
          //sorted by -age so oldest first
          expect(fetchedPets[0]).toEqual(older)
          expect(fetchedPets[1]).toEqual(younger)
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
# Animal ORM

A simple Object-Relational Mapping (ORM) system for FaunaDB.

## Installation

```
npm install animal-orm
```

## Documentation

### Classes

- **Model**: The base class for all models. 

- **Field**: The base class for all fields.

- **RefField**: Rerpresents a reference to another document

- **ManyToManyField**: Represents a relationship with another document that has a list cardinality in both directions. This requires a tertiary table.

### Functions

- **capitalize**: Capitalizes the first letter of a string.

- **depluralize**: Turns a plural English word into singular.

### Example

Here's a simple example of how to use the `animal-orm` module:

```typescript
import { Model, Field, ForeignKeyField, ManyToManyField } from 'animal-orm';
import * as z from 'zod';
import { query as q } from 'faunadb';

export const User = new Model('User', {
  name: new Field(z.string()),
  email: new Field(z.string().email()),
  password: new Field(z.string(), {hidden: true})
});

export const Pet = new Model('Pet', {
  name: new Field(z.string()),
  owner: new Ref(User, {reverse:"pets"}) //Sets up the reverse index
});

export default = [
  User,
  Pet
]
```

```typescript
> const User = new Model('User', {
  name: new Field(z.string()),
  email: new Field(z.string().email()),
  password: new Field(z.string(), {hidden: true})
})
> User.construct()
Do(
  CreateCollection({ name: 'User' })
);

> const Pet = new Model('Pet',
  name: new Field(z.string()),
  owner: new Ref(User, {reverse:"pets"}) //Sets up the reverse index
});
> Pet.construct()
Do(
  CreateCollection({ name: 'Pet' }),
  CreateIndex({
    name: 'Pets_by_Owner',
    source: Collection('Pet'),
    terms: [{ field: ['data', 'owner'] }],
    values: [{ field: ['ref'] }]
  }),
);

> const Trick = new Model('Trick',
  name: new Field(z.string()),
  trainedPets: new ManyToManyRelationship(Pet, {reverse:"tricks"}})
)
> Trick.construct()
q.Do(
  q.CreateCollection({ name: 'Trick' }),
  q.CreateIndex({
    name: 'TrainedPets_by_Trick',
    source: q.Collection('TrickTrainedPet'),
    terms: [{ field: ['data', 'trick'] }],
    values: [
      { field: ['ts'], reverse: true },
      { field: ['data', 'pet'] }
    ]
  }),
  q.CreateIndex({
    name: 'Tricks_by_TrainedPet',
    source: q.Collection('TrickTrainedPet'),
    terms: [{ field: ['data', 'pet'] }],
    values: [
      { field: ['ts'], reverse: true },
      { field: ['data', 'trick'] }
    ]
  })
);
> Trick.query('1')
q.Let({
  ref: q.Ref(q.Collection('Trick'), '1'),
  document: q.Get(q.Var('ref'))
}, {
  name: q.Select(['data', 'name'], q.Var('document')),
  trainedPets: q.Select(
    "data",
    q.Map(
      q.Paginate(q.Match(q.Index('TrainedPets_by_Trick'), q.Var('ref'))),
      q.Lambda(
        'values', 
        q.Let({
          ref: q.Select(q.Subtract(q.Count(q.Var('values')), 1), q.Var('values')),
          document: q.Get(q.Var('ref'))
        }, {
          name: q.Select(['data', 'name'], q.Var('document')),
          owner: q.Let({
            ref: q.Select(['data', 'owner'], q.Var('document')),
            document: q.Get(q.Var('ref'))
          }, {
            name: q.Select(['data', 'name'], q.Var('document')),
            email: q.Select(['data', 'email'], q.Var('document'))
          })
        })
      )
    )
  )
})

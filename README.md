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
> import { Model, Field, ForeignKeyField, ManyToManyField } from 'animal-orm';
> import * as z from 'zod';
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
  owner: new RefField(User, {reverse:"pets"}) //Sets up the reverse index
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
Do(
  CreateCollection({ name: 'Trick' }),
  CreateIndex({
    name: 'TrainedPets_by_Trick',
    source: Collection('TrickTrainedPet'),
    terms: [{ field: ['data', 'trick'] }],
    values: [
      { field: ['ts'], reverse: true },
      { field: ['data', 'pet'] }
    ]
  }),
  CreateIndex({
    name: 'Tricks_by_TrainedPet',
    source: Collection('TrickTrainedPet'),
    terms: [{ field: ['data', 'pet'] }],
    values: [
      { field: ['ts'], reverse: true },
      { field: ['data', 'trick'] }
    ]
  })
);
> Trick.query('1')
Let({
  ref: Ref(Collection('Trick'), '1'),
  document: Get(Var('ref'))
}, {
  name: Select(['data', 'name'], Var('document')),
  trainedPets: Select(
    "data",
    Map(
      Paginate(Match(Index('TrainedPets_by_Trick'), Var('ref'))),
      Lambda(
        'values', 
        Let({
          ref: Select(Subtract(Count(Var('values')), 1), Var('values')),
          document: Get(Var('ref'))
        }, {
          name: Select(['data', 'name'], Var('document')),
          owner: Let({
            ref: Select(['data', 'owner'], Var('document')),
            document: Get(Var('ref'))
          }, {
            name: Select(['data', 'name'], Var('document')),
            email: Select(['data', 'email'], Var('document'))
          })
        })
      )
    )
  )
})

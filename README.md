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
});

export const Pet = new Model('Pet', {
  name: new Field(z.string()),
  owner: new ForeignKeyField(User, {reverse:"pets"}) //Sets up the reverse index
});

export default = [
  User,
  Pet
]
```
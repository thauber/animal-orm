import { Expr, query as q } from 'faunadb';
import * as z from 'zod';
import { Field } from './Field';
import { ManyToManyField } from './ManyToManyField';

export interface ParseOptions {
  showHidden?: boolean;
  hideTertiaryRelations?: boolean;
}

export class Model {
  name: string;
  fields: { [key: string]: Field };

  constructor(name: string, fields: { [key: string]: Field }) {
    this.name = name;
    this.fields = fields;
  }

  construct() {
    const queries = [];
    queries.push(q.CreateCollection({ name: this.name }));

    for (const key in this.fields) {
      if (this.fields[key] instanceof Field) {
        const fieldConstructs = this.fields[key].construct(this.name, key);
        if (fieldConstructs) {
          queries.push(...fieldConstructs);
        }
      }
    }
    return q.Do(...queries);
  }

  schema(options: ParseOptions = {}): z.ZodType<any,any> {
    const zodSchema: Record<string,z.ZodType<any>> = {};

    for (const [key, field] of Object.entries<Field>(this.fields)) {
      const shouldNotHide = !(options.showHidden && field.options.hidden)
      const shouldNotRelate = !(options.hideTertiaryRelations && typeof field == typeof ManyToManyField)
      if (shouldNotHide && shouldNotRelate) {
        zodSchema[key] = field.schema(options);
      }
    }

    return z.object(zodSchema);
  }

  dereference(ref: Expr) {
    const subQueries = Object.entries(this.fields)
      .map(([fieldName, field]) => [fieldName, field.query(this.name, fieldName)]);
  
    return q.Let({
      ref: ref,
      document: q.Get(ref)
    }, {
      ...Object.fromEntries(subQueries)
    });
  }

  query(id: string) {
    return this.dereference(q.Ref(q.Collection(this.name), id))
  }
}

import { register } from "./tables";

register({
  name: "tags",

  title: "Tags",

  allowCreate: true,
  changes: true,

  query: {
    crm_tags: [
      {
        name: null,
        icon: null,
        color: null,
        description: null,
        last_edited: null,
        last_modified_by: null,
        created: null,
        id: null,
      },
    ],
  },
  updateDefaults: {
    last_modified_by: "[account_id]",
    last_edited: "now()",
  },
});

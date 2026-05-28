import { pgSchema, text, timestamp, boolean } from 'drizzle-orm/pg-core'

// Schema isolado `auth.*` — manda separado do schema `public` do Rails.
// Quando Drizzle migra, só toca tabelas dentro de `auth`. Quando Rails migra,
// só toca `public.*`. Zero colisão de migration tooling.
export const authSchema = pgSchema('auth')

export const user = authSchema.table('user', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image:         text('image'),
  // Atributos extras para Better Auth org plugin.
  role:          text('role'),
  banned:        boolean('banned').default(false),
  banReason:     text('ban_reason'),
  banExpiresAt:  timestamp('ban_expires_at'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
})

export const session = authSchema.table('session', {
  id:               text('id').primaryKey(),
  expiresAt:        timestamp('expires_at').notNull(),
  token:            text('token').notNull().unique(),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  ipAddress:        text('ip_address'),
  userAgent:        text('user_agent'),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Org plugin — workspace ativo na sessão.
  activeOrganizationId: text('active_organization_id'),
  impersonatedBy:   text('impersonated_by'),
})

export const account = authSchema.table('account', {
  id:                     text('id').primaryKey(),
  accountId:              text('account_id').notNull(),
  providerId:             text('provider_id').notNull(),
  userId:                 text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken:            text('access_token'),
  refreshToken:           text('refresh_token'),
  idToken:                text('id_token'),
  accessTokenExpiresAt:   timestamp('access_token_expires_at'),
  refreshTokenExpiresAt:  timestamp('refresh_token_expires_at'),
  scope:                  text('scope'),
  password:               text('password'),
  createdAt:              timestamp('created_at').notNull().defaultNow(),
  updatedAt:              timestamp('updated_at').notNull().defaultNow(),
})

export const verification = authSchema.table('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  timestamp('expires_at').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
})

// Organization plugin tables — workspace ↔ user na ótica do Better Auth.
// Mantemos espelho com workspace_members do Rails: ID do organization é o
// workspace.id; member.organizationId = workspace.id.
export const organization = authSchema.table('organization', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  slug:      text('slug').unique(),
  logo:      text('logo'),
  metadata:  text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const member = authSchema.table('member', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId:         text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role:           text('role').notNull().default('member'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

export const invitation = authSchema.table('invitation', {
  id:             text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email:          text('email').notNull(),
  role:           text('role'),
  status:         text('status').notNull().default('pending'),
  expiresAt:      timestamp('expires_at').notNull(),
  inviterId:      text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

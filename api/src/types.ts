// Tipagem do contexto Hono: userId é injetado pelo middleware de auth.
export type Env = { Variables: { userId: string } };

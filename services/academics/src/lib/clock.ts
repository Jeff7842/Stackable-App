/** Injected so tests and the deadline worker can move time; production uses the server clock. */
export type Clock = () => Date;

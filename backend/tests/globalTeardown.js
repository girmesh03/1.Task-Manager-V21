export default async function globalTeardown() {
  // Stop MongoDB Memory Server
  if (global.__MONGOSERVER__) {
    await global.__MONGOSERVER__.stop();
    console.log("MongoDB Memory Server stopped");
  }
}

import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("play/:gameId", "routes/play.$gameId.tsx"),
  route("api/games", "routes/api.games.tsx"),
  route("api/games/:gameId", "routes/api.games.$gameId.tsx"),
  route("api/games/:gameId/rom", "routes/api.games.$gameId.rom.tsx"),
  route("api/states/:gameId/:emulatorId/:slot", "routes/api.states.$gameId.$emulatorId.$slot.tsx"),
] satisfies RouteConfig;

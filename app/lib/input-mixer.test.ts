import { expect, it } from "vitest";
import { createInputMixer } from "./input-mixer";

it("keeps a button held until all physical input sources release it", () => {
  const events: [string, boolean][] = [];
  const mixer = createInputMixer((button, pressed) => events.push([button, pressed]));
  mixer.set("keyboard", "a", true);
  mixer.set("gamepad", "a", true);
  mixer.set("gamepad", "a", true);
  mixer.set("keyboard", "a", false);
  expect(events).toEqual([["a", true]]);
  mixer.set("touch", "a", true);
  mixer.set("gamepad", "a", false);
  mixer.set("touch", "a", false);
  expect(events).toEqual([["a", true], ["a", false]]);
});

it("releases every held button on suspend and accepts new input afterward", () => {
  const events: [string, boolean][] = [];
  const mixer = createInputMixer((button, pressed) => events.push([button, pressed]));
  mixer.set("gamepad", "left", true);
  mixer.set("keyboard", "left", true);
  mixer.releaseAll();
  mixer.releaseAll();
  mixer.set("gamepad", "left", true);
  expect(events).toEqual([["left", true], ["left", false], ["left", true]]);
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createVitalsQueue, type VitalReport } from "./vitals-queue";

const report = (name: string, value: number): VitalReport => ({ name, value, rating: "good", route: "/admin" });

/** Gönderilen gövdeleri toplar */
function recorder() {
  const bodies: { metrics: VitalReport[] }[] = [];
  const send = (body: string) => void bodies.push(JSON.parse(body) as { metrics: VitalReport[] });
  return { bodies, queue: createVitalsQueue(send) };
}

describe("Web Vitals kuyruğu", () => {
  test("ölçüler geldikçe gitmez, boşaltınca hepsi tek istekte gider", () => {
    const { bodies, queue } = recorder();
    queue.add(report("TTFB", 120));
    queue.add(report("FCP", 800));
    queue.add(report("LCP", 1400));
    assert.equal(bodies.length, 0);
    queue.flush();
    assert.equal(bodies.length, 1);
    assert.deepEqual(
      bodies[0].metrics.map((metric) => metric.name),
      ["TTFB", "FCP", "LCP"],
    );
  });

  test("aynı ölçünün yenisi eskisinin yerini alır", () => {
    const { bodies, queue } = recorder();
    queue.add(report("CLS", 0.02));
    queue.add(report("CLS", 0.08));
    queue.flush();
    assert.deepEqual(bodies[0].metrics, [report("CLS", 0.08)]);
  });

  test("boş kuyruk istek atmaz; boşaltmadan sonra yalnız yeni ölçüler gider", () => {
    const { bodies, queue } = recorder();
    queue.flush();
    assert.equal(bodies.length, 0, "boş kuyruk");
    queue.add(report("FCP", 800));
    queue.flush();
    queue.add(report("INP", 90));
    queue.flush();
    assert.equal(bodies.length, 2);
    assert.deepEqual(
      bodies[1].metrics.map((metric) => metric.name),
      ["INP"],
    );
  });
});

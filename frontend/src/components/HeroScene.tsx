import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * A contained 3D hero. Unlike the old full-window scene, this one measures
 * its OWN box (ResizeObserver) and never draws outside it, so it can't slide
 * under headlines. It pauses when off-screen / tab hidden and renders a
 * single still frame when the user prefers reduced motion.
 *
 *  network   — database core + warehouses wired together (owner / admin)
 *  warehouse — one big warehouse with orbiting stock (manager)
 *  core      — the PostgreSQL core (login / DBMS)
 *  crates    — floating product crates (customer)
 */
export type SceneVariant = "network" | "warehouse" | "core" | "crates";

export default function HeroScene({ variant = "warehouse", accent = 0xffd23f }: { variant?: SceneVariant; accent?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the CSS backdrop stays and the page remains fully usable
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 10, 8);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    const mat = (c: number, o: THREE.MeshPhysicalMaterialParameters = {}) =>
      new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18, ...o });
    const M = {
      a: mat(accent),
      k: mat(0x121211, { roughness: 0.45 }),
      w: mat(0xf3efe4, { roughness: 0.5 }),
      v: mat(0x6a5cff, { emissive: 0x6a5cff, emissiveIntensity: 0.55 }),
    };
    const rb = (w: number, h: number, d: number, m: THREE.Material, r = 0.06) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
    const put = <T extends THREE.Object3D>(g: THREE.Object3D, o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); g.add(o); return o; };

    const warehouse = (s = 1) => {
      const g = new THREE.Group();
      put(g, rb(6.4, 0.28, 4.4, M.k, 0.1), 0, -1.14, 0);
      put(g, rb(5.6, 2.1, 3.6, M.w, 0.12), 0, 0.05, 0);
      const tooth = new THREE.Shape();
      tooth.moveTo(0, 0); tooth.lineTo(1.8, 0.85); tooth.lineTo(1.8, 0); tooth.lineTo(0, 0);
      const toothGeo = new THREE.ExtrudeGeometry(tooth, { depth: 3.7, bevelEnabled: false });
      for (const x of [-2.7, -0.9, 0.9]) put(g, new THREE.Mesh(toothGeo, M.k), x, 1.1, -1.85);
      for (const x of [-1.8, 0, 1.8]) {
        put(g, rb(1.3, 1.35, 0.12, M.a, 0.05), x, -0.32, 1.84);
        put(g, rb(1.55, 0.07, 0.55, M.k, 0.02), x, -0.98, 2.15);
      }
      put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), M.k), 2.5, 2.2, 0);
      const beacon = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), M.v), 2.5, 2.55, 0) as THREE.Mesh;
      g.scale.setScalar(s);
      return { g, beacon };
    };

    const dbCore = (s = 1) => {
      const g = new THREE.Group();
      const body = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        put(body, new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.74, 48), i === 1 ? M.k : M.w), 0, i * 0.9 - 0.9, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.06, 12, 64), M.a);
        ring.rotation.x = Math.PI / 2;
        put(body, ring, 0, i * 0.9 - 0.45, 0);
      }
      put(body, new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 40), M.v), 0, 1.0, 0);
      g.add(body);
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.035, 10, 100), M.v);
      orbit.rotation.x = Math.PI / 2.4;
      g.add(orbit);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), M.a);
      dot.position.set(2.3, 0, 0);
      orbit.add(dot);
      g.scale.setScalar(s);
      return { g, body, orbit };
    };

    // orbiting stock crates
    const crateMats = [M.a, M.k, M.w, M.a, M.v];
    const crates = (n: number, rMin: number, rMax: number, big = 0.4) => {
      const grp = new THREE.Group();
      const data = Array.from({ length: n }, (_, i) => {
        const s = 0.22 + Math.random() * big;
        const mesh = rb(s, s, s, crateMats[i % crateMats.length], s * 0.22);
        grp.add(mesh);
        return { mesh, r: rMin + Math.random() * (rMax - rMin), a: Math.random() * Math.PI * 2, sp: (0.08 + Math.random() * 0.14) * (i % 2 ? 1 : -1), h: (Math.random() - 0.5) * 3.2, f: 0.5 + Math.random(), ph: Math.random() * 6, spin: 0.2 + Math.random() * 0.6 };
      });
      return { grp, data };
    };

    // ---------- compose by variant ----------
    const root = new THREE.Group();
    scene.add(root);
    const animators: ((t: number) => void)[] = [];

    if (variant === "network") {
      const hub = dbCore(0.55);
      hub.g.position.set(0, 0.4, 0);
      root.add(hub.g);
      animators.push((t) => { hub.body.rotation.y = t * 0.7; hub.orbit.rotation.z = t * 1.0; });
      const spots: [number, number][] = [[-4.4, 1.6], [4.4, 1.6], [-3.0, -3.2], [3.0, -3.2]];
      spots.forEach(([x, z], i) => {
        const w = warehouse(0.46);
        w.g.position.set(x, -0.9, z);
        w.g.rotation.y = Math.atan2(x, z + 6) * 0.9;
        root.add(w.g);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, -0.4, z), new THREE.Vector3(x * 0.5, 1.4, z * 0.5), new THREE.Vector3(0, 0.4, 0)]);
        root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.022, 6, false), M.k));
        const packet = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), M.v);
        root.add(packet);
        animators.push((t) => { curve.getPoint((t * 0.32 + i / 4) % 1, packet.position); w.beacon.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.28); });
      });
      root.rotation.x = 0.12;
    } else if (variant === "warehouse") {
      const w = warehouse(1);
      root.add(w.g);
      const c = crates(14, 4.2, 5.4);
      root.add(c.grp);
      animators.push((t) => {
        w.g.position.y = Math.sin(t * 0.9) * 0.14;
        w.beacon.scale.setScalar(1 + Math.sin(t * 4) * 0.25);
        c.data.forEach((d) => { const a = d.a + t * d.sp; d.mesh.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * d.f + d.ph) * 0.3, Math.sin(a) * d.r * 0.55); d.mesh.rotation.x = t * d.spin + d.ph; d.mesh.rotation.y = t * d.spin * 0.7; });
      });
    } else if (variant === "core") {
      const core = dbCore(1.25);
      root.add(core.g);
      const c = crates(12, 3.8, 5);
      root.add(c.grp);
      animators.push((t) => {
        core.body.rotation.y = t * 0.45; core.orbit.rotation.z = t * 0.7; core.g.position.y = Math.sin(t * 0.8) * 0.18;
        c.data.forEach((d) => { const a = d.a + t * d.sp; d.mesh.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * d.f + d.ph) * 0.3, Math.sin(a) * d.r * 0.55); d.mesh.rotation.x = t * d.spin; d.mesh.rotation.y = t * d.spin * 0.7; });
      });
    } else {
      const big = [rb(2.6, 2.0, 2.2, M.a, 0.2), rb(1.7, 1.3, 1.6, M.w, 0.16), rb(1.3, 1.0, 1.2, M.k, 0.14)];
      put(root, big[0], 0, -0.9, 0); put(root, big[1], 1.2, 0.75, 0.2); put(root, big[2], -1.3, 0.55, 0.4);
      const tape = rb(2.7, 0.14, 0.5, M.k, 0.04); put(root, tape, 0, 0.12, 0.9);
      const c = crates(16, 3.6, 5.2, 0.5);
      root.add(c.grp);
      animators.push((t) => {
        big[0].rotation.y = Math.sin(t * 0.6) * 0.25; big[1].position.y = 0.75 + Math.sin(t * 1.1) * 0.12; big[2].position.y = 0.55 + Math.sin(t * 1.3 + 1) * 0.12;
        c.data.forEach((d) => { const a = d.a + t * d.sp; d.mesh.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * d.f + d.ph) * 0.3, Math.sin(a) * d.r * 0.55); d.mesh.rotation.x = t * d.spin; d.mesh.rotation.y = t * d.spin * 0.7; });
      });
    }

    // ---------- sizing: always relative to OUR box ----------
    const size = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const fit = 21 / Math.min(1, camera.aspect * 1.05);
      camera.position.set(0, 2.6, fit);
      camera.lookAt(0, 0, 0);
      draw(0);
    };
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; };
    const draw = (t: number) => {
      animators.forEach((a) => a(t));
      const pop = reduce ? 1 : Math.min(1, t / 1.4);
      const s = pop === 1 ? 1 : 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2);
      root.scale.setScalar(Math.max(0.001, s));
      root.rotation.y = (variant === "network" ? t * 0.12 : -0.5 + Math.sin(t * 0.5) * 0.18) + pointer.x * 0.5 + (reduce ? 0 : (1 - pop) * -3);
      renderer.render(scene, camera);
    };

    const ro = new ResizeObserver(size);
    ro.observe(mount);
    window.addEventListener("pointermove", onMove, { passive: true });
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      clock.getDelta(); // advances clock.elapsedTime
      if (!visible || document.hidden) return;
      draw(clock.elapsedTime);
    };
    if (!reduce) tick();
    size();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose();
      });
      pmrem.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [variant, accent]);

  return <div ref={ref} className="scene" aria-hidden="true" />;
}

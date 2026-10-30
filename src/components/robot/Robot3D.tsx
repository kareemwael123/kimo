'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, ContactShadows, RoundedBox, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// =====================
// Robot 3D character — "بوص" — inside a 3D room, moves freely between locations
// =====================

export type Emotion = 'neutral' | 'happy' | 'tired' | 'sad' | 'stressed';
export type Mode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'walking';

// Anchor points in the room (X, Z, rotation-y) — robot walks between these
export const LOCATIONS: Record<string, [number, number, number]> = {
  center:  [ 0,    0,    0 ],
  couch:   [-4.2, -3.5,  Math.PI / 2.2],
  table:   [ 3.8, -1.8, -Math.PI / 2.5],
  plant:   [ 5.0, -5.0, -Math.PI],
  window:  [ 0,   -6.5,  Math.PI],
  lamp:    [-6.2,  1.5,  Math.PI / 2.5],
};

// Mood-based lighting
const EMOTION_LIGHT: Record<Emotion, {
  ambient: number;
  key: number;
  keyColor: string;
  fill: string;
}> = {
  neutral:  { ambient: 0.55, key: 1.0, keyColor: '#ffffff', fill: '#a78bfa' },
  happy:    { ambient: 0.65, key: 1.3, keyColor: '#fef3c7', fill: '#fbbf24' },
  tired:    { ambient: 0.3,  key: 0.55,keyColor: '#9ca3af', fill: '#1e293b' },
  sad:      { ambient: 0.4,  key: 0.7, keyColor: '#7dd3fc', fill: '#0ea5e9' },
  stressed: { ambient: 0.5,  key: 1.1, keyColor: '#fef08a', fill: '#dc2626' },
};

// Sky color visible through the window — changes with mood
const EMOTION_SKY: Record<Emotion, string> = {
  neutral:  '#1e3a8a',
  happy:    '#3b82f6',
  tired:    '#1e293b',
  sad:      '#334155',
  stressed: '#3b0a0a',
};

// =====================
// Room — floor, walls, ceiling, window, lamp, couch, table, plant, art
// =====================
function Room({ emotion }: { emotion: Emotion }) {
  const sky = EMOTION_SKY[emotion];

  return (
    <group>
      {/* ===== Floor ===== */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.6, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#1a1d2e" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Rug under robot — colorful when happy, muted when sad */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.59, 0]}>
        <circleGeometry args={[2.8, 64]} />
        <meshStandardMaterial
          color={emotion === 'happy' ? '#a855f7' : emotion === 'sad' ? '#475569' : '#7c3aed'}
          roughness={0.95}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.585, 0]}>
        <ringGeometry args={[2.3, 2.7, 64]} />
        <meshStandardMaterial color={emotion === 'happy' ? '#f472b6' : '#a78bfa'} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.58, 0]}>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial color={emotion === 'happy' ? '#7c3aed' : '#6366f1'} />
      </mesh>

      {/* ===== Walls ===== */}
      {/* Back wall */}
      <mesh position={[0, 1.5, -8]} receiveShadow>
        <planeGeometry args={[24, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} />
      </mesh>
      {/* Left wall */}
      <mesh rotation-y={Math.PI / 2} position={[-8, 1.5, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.95} />
      </mesh>
      {/* Right wall */}
      <mesh rotation-y={-Math.PI / 2} position={[8, 1.5, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.95} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation-x={Math.PI / 2} position={[0, 7.5, 0]}>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#0a0f1f" roughness={0.9} />
      </mesh>

      {/* ===== Window on back wall ===== */}
      <group position={[0, 3.5, -7.95]}>
        {/* Outer frame */}
        <mesh>
          <planeGeometry args={[4, 2.5]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Sky */}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[3.7, 2.2]} />
          <meshStandardMaterial
            color={sky}
            emissive={sky}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
        {/* Window cross bars */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[3.7, 0.08]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.08, 2.2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Cloud in window — only when happy */}
        {emotion === 'happy' && (
          <mesh position={[1.0, 0.5, 0.03]}>
            <circleGeometry args={[0.4, 24]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} transparent opacity={0.85} />
          </mesh>
        )}
      </group>

      {/* ===== Hanging lamp from ceiling ===== */}
      <group position={[3, 7.5, -4]}>
        {/* Cord */}
        <mesh position={[0, -0.8, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Lampshade */}
        <mesh position={[0, -1.7, 0]}>
          <coneGeometry args={[0.45, 0.5, 16]} />
          <meshStandardMaterial
            color="#fef3c7"
            emissive="#fef3c7"
            emissiveIntensity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Light bulb */}
        <pointLight
          position={[0, -1.9, 0]}
          intensity={2.5}
          distance={10}
          color="#fde68a"
          castShadow
        />
        {/* Visible bulb */}
        <mesh position={[0, -1.85, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#fef9c3" emissive="#fef9c3" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>

      {/* ===== Couch on the left ===== */}
      <group position={[-5, -1.6, -4]}>
        {/* Base */}
        <RoundedBox args={[2.5, 0.5, 1.2]} radius={0.1} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color="#7c2d12" />
        </RoundedBox>
        {/* Back */}
        <RoundedBox args={[2.5, 1.1, 0.3]} radius={0.1} position={[0, 1.25, -0.45]} castShadow>
          <meshStandardMaterial color="#92400e" />
        </RoundedBox>
        {/* Cushions */}
        <RoundedBox args={[1.05, 0.35, 0.95]} radius={0.1} position={[-0.6, 0.95, 0.05]} castShadow>
          <meshStandardMaterial color="#a16207" />
        </RoundedBox>
        <RoundedBox args={[1.05, 0.35, 0.95]} radius={0.1} position={[0.6, 0.95, 0.05]} castShadow>
          <meshStandardMaterial color="#a16207" />
        </RoundedBox>
        {/* Pillow */}
        <RoundedBox args={[0.5, 0.3, 0.4]} radius={0.08} position={[-0.8, 1.35, 0]} castShadow>
          <meshStandardMaterial color="#fb7185" />
        </RoundedBox>
      </group>

      {/* ===== Round table on the right ===== */}
      <group position={[5, -1.6, -2.5]}>
        {/* Tabletop */}
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.65, 0.65, 0.08, 32]} />
          <meshStandardMaterial color="#451a03" metalness={0.1} roughness={0.4} />
        </mesh>
        {/* Table leg */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.45, 16]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Table base */}
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Coffee mug on table */}
        <mesh position={[0.2, 0.7, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.18, 24]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        {/* Mug handle */}
        <mesh position={[0.32, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.05, 0.02, 8, 16]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        {/* Coffee */}
        <mesh position={[0.2, 0.79, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.005, 24]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Book on table */}
        <RoundedBox args={[0.35, 0.05, 0.45]} radius={0.01} position={[-0.25, 0.69, 0.1]} castShadow>
          <meshStandardMaterial color="#16a34a" />
        </RoundedBox>
      </group>

      {/* ===== Plant in corner ===== */}
      <group position={[6.5, -1.6, -6]}>
        {/* Pot */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.28, 0.6, 24]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
        {/* Soil */}
        <mesh position={[0, 0.59, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.02, 24]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
        {/* Leaves */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#15803d" roughness={0.7} />
        </mesh>
        <mesh position={[0.25, 1.35, 0.1]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#16a34a" roughness={0.7} />
        </mesh>
        <mesh position={[-0.2, 1.45, -0.1]} castShadow>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshStandardMaterial color="#22c55e" roughness={0.7} />
        </mesh>
        <mesh position={[0.1, 1.65, 0.2]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#22c55e" roughness={0.7} />
        </mesh>
      </group>

      {/* ===== Wall art (smiley poster) ===== */}
      <group position={[-3.5, 3.5, -7.95]}>
        {/* Frame */}
        <mesh>
          <planeGeometry args={[1.4, 1.0]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        {/* Canvas */}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1.2, 0.8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Smiley face */}
        <mesh position={[-0.2, 0.15, 0.02]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[0.2, 0.15, 0.02]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[0, -0.15, 0.02]} rotation={[0, 0, Math.PI]}>
          <ringGeometry args={[0.15, 0.22, 24, 1, 0, Math.PI]} />
          <meshStandardMaterial color="#fbbf24" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ===== Bookshelf on right wall ===== */}
      <group position={[7.95, 0, -2]} rotation-y={-Math.PI / 2}>
        {/* Shelves */}
        {[0, 0.6, 1.2, 1.8].map((y, i) => (
          <mesh key={i} position={[0, -1.6 + y, 0]} castShadow>
            <boxGeometry args={[1.8, 0.05, 0.4]} />
            <meshStandardMaterial color="#451a03" />
          </mesh>
        ))}
        {/* Side panels */}
        <mesh position={[-0.9, -0.7, 0]}>
          <boxGeometry args={[0.05, 2.0, 0.4]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        <mesh position={[0.9, -0.7, 0]}>
          <boxGeometry args={[0.05, 2.0, 0.4]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Books */}
        {[[-0.6, 0.08, 0], [-0.3, 0.08, 0], [0.0, 0.08, 0], [0.3, 0.08, 0], [0.6, 0.08, 0]].map((p, i) => (
          <mesh key={i} position={[p[0], -1.55 + 0.05, p[2]]} castShadow>
            <boxGeometry args={[0.18, 0.28, 0.3]} />
            <meshStandardMaterial color={['#dc2626', '#16a34a', '#2563eb', '#ca8a04', '#9333ea'][i]} />
          </mesh>
        ))}
        {[[-0.5, 0.08, 0], [-0.1, 0.08, 0], [0.4, 0.08, 0]].map((p, i) => (
          <mesh key={i} position={[p[0], -1.55 + 0.65, p[2]]} castShadow>
            <boxGeometry args={[0.18, 0.32, 0.3]} />
            <meshStandardMaterial color={['#16a34a', '#dc2626', '#7c3aed'][i]} />
          </mesh>
        ))}
      </group>

      {/* ===== Floor lamp in left corner ===== */}
      <group position={[-7, -1.6, 2]}>
        {/* Base */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.25, 0.3, 0.1, 16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Pole */}
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        {/* Shade */}
        <mesh position={[0, 2.1, 0]}>
          <coneGeometry args={[0.35, 0.5, 16]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fef3c7" emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 1.9, 0]} intensity={1.5} distance={6} color="#fde68a" />
      </group>
    </group>
  );
}

// =====================
// Robot mesh — with eyebrows, tears, sweat, blush
// =====================
function RobotMesh({
  emotion, mode, targetLocation,
}: {
  emotion: Emotion;
  mode: Mode;
  targetLocation: string;
}) {
  const group = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftBrow = useRef<THREE.Mesh>(null);
  const rightBrow = useRef<THREE.Mesh>(null);
  const antenna = useRef<THREE.Group>(null);
  const antennaTip = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  const blinkTimer = useRef(0);
  const speakingTimer = useRef(0);
  const walkTimer = useRef(0);
  const currentTarget = useRef<[number, number, number]>(LOCATIONS.center);
  const isWalking = useRef(false);

  // Per-emotion eyebrow rotation
  const browAngle: Record<Emotion, number> = {
    neutral: 0,
    happy: -0.2,
    tired: 0.25,
    sad: 0.35,
    stressed: 0.45,
  };

  // Update target whenever targetLocation changes
  useEffect(() => {
    const next = LOCATIONS[targetLocation] || LOCATIONS.center;
    currentTarget.current = next;
    isWalking.current = true;
  }, [targetLocation]);

  useFrame((state, delta) => {
    if (!group.current || !head.current) return;
    const t = state.clock.elapsedTime;

    // ===== Walking logic — smoothly move to target location =====
    const target = currentTarget.current;
    const [tx, tz, tr] = target;
    const dx = tx - group.current.position.x;
    const dz = tz - group.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.05) {
      // Walk towards target
      isWalking.current = true;
      const speed = emotion === 'tired' ? 1.0 : emotion === 'stressed' ? 3.0 : emotion === 'happy' ? 2.2 : 1.7;
      const move = Math.min(dist, speed * delta);
      group.current.position.x += (dx / dist) * move;
      group.current.position.z += (dz / dist) * move;
      // Face direction of motion
      const angleToTarget = Math.atan2(dx, dz);
      // Smooth rotation towards target
      let currentRot = group.current.rotation.y;
      let diff = angleToTarget - currentRot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.current.rotation.y += diff * Math.min(1, delta * 6);
    } else {
      // Arrived — settle to target rotation
      isWalking.current = false;
      let diff = tr - group.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.current.rotation.y += diff * Math.min(1, delta * 3);
    }

    // ===== Walking animation: bob + leg swing =====
    if (isWalking.current) {
      walkTimer.current += delta * 8;
      const bob = Math.abs(Math.sin(walkTimer.current)) * 0.08;
      group.current.position.y = bob;
      // Leg swing
      const swing = Math.sin(walkTimer.current) * 0.5;
      if (leftLeg.current)  leftLeg.current.rotation.x  = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      // Arm swing while walking
      if (leftArm.current)  leftArm.current.rotation.x  = -swing * 0.5;
      if (rightArm.current) rightArm.current.rotation.x =  swing * 0.5;
    } else {
      // Idle — reset leg/arm rotation when not walking
      if (leftLeg.current)  leftLeg.current.rotation.x  = 0;
      if (rightLeg.current) rightLeg.current.rotation.x = 0;
      // Idle body motion per emotion
      if (emotion === 'happy') {
        group.current.position.y = Math.sin(t * 2.5) * 0.15;
        head.current.rotation.z = Math.sin(t * 1.5) * 0.04;
        head.current.rotation.x = Math.sin(t * 0.8) * 0.03;
      } else if (emotion === 'tired') {
        group.current.position.y = Math.sin(t * 0.4) * 0.04 - 0.1;
        head.current.rotation.x = 0.22;
        head.current.rotation.z = Math.sin(t * 0.3) * 0.02;
      } else if (emotion === 'sad') {
        group.current.position.y = -0.12 + Math.sin(t * 0.5) * 0.02;
        head.current.rotation.x = 0.3;
        head.current.rotation.z = Math.sin(t * 0.4) * 0.03;
      } else if (emotion === 'stressed') {
        group.current.position.y = -0.05 + Math.sin(t * 12) * 0.03;
        group.current.position.x = tx + Math.sin(t * 18) * 0.04;
        head.current.rotation.x = 0;
        head.current.rotation.z = Math.sin(t * 16) * 0.03;
      } else {
        group.current.position.y = Math.sin(t * 1.2) * 0.06;
        head.current.rotation.x = Math.sin(t * 0.6) * 0.02;
        head.current.rotation.z = Math.sin(t * 0.5) * 0.02;
      }
    }

    // ===== Listening mode — head tilts toward user (camera) =====
    if (mode === 'listening') {
      head.current.rotation.y = Math.sin(t * 0.5) * 0.15;
      head.current.rotation.x += 0.05;
    } else if (mode === 'thinking') {
      // Thinking — look up, slight head tilt
      head.current.rotation.x = 0.15 + Math.sin(t * 0.8) * 0.05;
      head.current.rotation.z = -0.1;
    } else {
      head.current.rotation.y = Math.sin(t * 0.4) * 0.05;
    }

    // ===== Antenna wobble =====
    if (antenna.current) {
      const wobbleSpeed = mode === 'thinking' ? 5 : 2;
      antenna.current.rotation.z = Math.sin(t * wobbleSpeed) * 0.15;
    }
    if (antennaTip.current && antennaTip.current.material instanceof THREE.MeshStandardMaterial) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (mode === 'thinking' ? 8 : 4));
      antennaTip.current.material.emissiveIntensity = 0.8 + pulse * (mode === 'thinking' ? 1.4 : 0.8);
    }

    // ===== Blinking =====
    blinkTimer.current -= delta;
    let blinkInterval = 3 + Math.random() * 2;
    let blinkDuration = 0.12;
    if (emotion === 'tired') { blinkInterval = 1.5; blinkDuration = 0.35; }
    if (emotion === 'stressed') blinkInterval = 1.0;
    if (emotion === 'sad') blinkInterval = 4;
    if (mode === 'listening') blinkInterval = 1.5;

    if (blinkTimer.current < -blinkInterval) blinkTimer.current = blinkDuration;
    const isBlinking = blinkTimer.current > 0;
    const eyeScaleY = isBlinking ? 0.1 : 1;

    if (leftEye.current) leftEye.current.scale.y = eyeScaleY;
    if (rightEye.current) rightEye.current.scale.y = eyeScaleY;

    // Eye glow pulse
    const eyePulse = emotion === 'happy' || emotion === 'stressed'
      ? 0.8 + Math.sin(t * 6) * 0.4
      : 0.6;
    [leftEye, rightEye].forEach((eyeRef) => {
      if (eyeRef.current && eyeRef.current.material instanceof THREE.MeshStandardMaterial) {
        eyeRef.current.material.emissiveIntensity = eyePulse;
      }
    });

    // ===== Eyebrows =====
    const targetBrowAngle = browAngle[emotion];
    if (leftBrow.current) {
      leftBrow.current.rotation.z = targetBrowAngle;
    }
    if (rightBrow.current) {
      rightBrow.current.rotation.z = -targetBrowAngle;
    }

    // ===== Mouth animation =====
    if (mouth.current) {
      if (mode === 'speaking') {
        speakingTimer.current += delta;
        const mouthOpen = 0.4 + Math.abs(Math.sin(speakingTimer.current * 18)) * 0.8;
        mouth.current.scale.y = mouthOpen;
        mouth.current.scale.x = 1;
      } else {
        if (emotion === 'happy') {
          mouth.current.scale.y = 0.5;
          mouth.current.scale.x = 1.2;
        } else if (emotion === 'sad') {
          mouth.current.scale.y = 0.15;
          mouth.current.scale.x = 1;
        } else if (emotion === 'stressed') {
          mouth.current.scale.y = 0.6 + Math.sin(t * 8) * 0.2;
          mouth.current.scale.x = 1;
        } else if (emotion === 'tired') {
          mouth.current.scale.y = 0.25;
          mouth.current.scale.x = 1;
        } else {
          mouth.current.scale.y = 0.3;
          mouth.current.scale.x = 1;
        }
      }
    }

    // ===== Arm wave when happy (only when not walking) =====
    if (!isWalking.current) {
      if (emotion === 'happy' && rightArm.current && mode !== 'speaking') {
        rightArm.current.rotation.z = -1.2 + Math.sin(t * 6) * 0.3;
      } else if (rightArm.current) {
        rightArm.current.rotation.z = -0.4;
      }
      if (leftArm.current) {
        leftArm.current.rotation.z = 0.4;
      }
    }
  });

  return (
    <group ref={group} position={[0, 0, 0]} scale={1}>
      {/* Body */}
      <RoundedBox args={[1.2, 1.4, 0.9]} radius={0.25} smoothness={6} position={[0, -0.2, 0]} castShadow>
        <meshStandardMaterial color="#06b6d4" metalness={0.4} roughness={0.35} />
      </RoundedBox>
      {/* Chest panel */}
      <RoundedBox args={[0.7, 0.5, 0.05]} radius={0.08} position={[0, -0.15, 0.46]}>
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.3} metalness={0.6} roughness={0.2} />
      </RoundedBox>
      {/* Chest heart — lights up when happy */}
      {emotion === 'happy' && (
        <mesh position={[0, -0.1, 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.12, 0.12, 0.02]} />
          <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      )}

      {/* ===== Head group ===== */}
      <group ref={head} position={[0, 1.05, 0]}>
        {/* Head */}
        <RoundedBox args={[1.0, 0.85, 0.85]} radius={0.18} smoothness={6} castShadow>
          <meshStandardMaterial color="#06b6d4" metalness={0.4} roughness={0.35} />
        </RoundedBox>
        {/* Face screen */}
        <RoundedBox args={[0.78, 0.6, 0.05]} radius={0.1} position={[0, 0.05, 0.43]}>
          <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.1} />
        </RoundedBox>

        {/* Eyes */}
        <mesh ref={leftEye} position={[-0.18, 0.15, 0.47]}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh ref={rightEye} position={[0.18, 0.15, 0.47]}>
          <sphereGeometry args={[0.09, 24, 24]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>

        {/* Eyebrows */}
        <mesh ref={leftBrow} position={[-0.18, 0.35, 0.46]}>
          <boxGeometry args={[0.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#0c4a6e" />
        </mesh>
        <mesh ref={rightBrow} position={[0.18, 0.35, 0.46]}>
          <boxGeometry args={[0.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#0c4a6e" />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouth} position={[0, -0.2, 0.46]}>
          <boxGeometry args={[0.32, 0.05, 0.04]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
        </mesh>

        {/* Blush when happy */}
        {emotion === 'happy' && (
          <>
            <mesh position={[-0.34, -0.08, 0.45]}>
              <circleGeometry args={[0.07, 16]} />
              <meshStandardMaterial color="#fb7185" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0.34, -0.08, 0.45]}>
              <circleGeometry args={[0.07, 16]} />
              <meshStandardMaterial color="#fb7185" transparent opacity={0.7} />
            </mesh>
          </>
        )}

        {/* Tears when sad */}
        {emotion === 'sad' && (
          <>
            <mesh position={[-0.18, -0.08, 0.48]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial
                color="#60a5fa"
                emissive="#60a5fa"
                emissiveIntensity={0.5}
                transparent
                opacity={0.9}
              />
            </mesh>
            <mesh position={[0.18, -0.08, 0.48]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial
                color="#60a5fa"
                emissive="#60a5fa"
                emissiveIntensity={0.5}
                transparent
                opacity={0.9}
              />
            </mesh>
          </>
        )}

        {/* Sweat drop when stressed */}
        {emotion === 'stressed' && (
          <mesh position={[0.48, 0.3, 0.4]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial
              color="#bfdbfe"
              emissive="#bfdbfe"
              emissiveIntensity={0.4}
              transparent
              opacity={0.85}
            />
          </mesh>
        )}

        {/* Zzz when tired */}
        {emotion === 'tired' && (
          <mesh position={[0.4, 0.5, 0.4]}>
            <circleGeometry args={[0.08, 24]} />
            <meshStandardMaterial color="#94a3b8" emissive="#94a3b8" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        )}

        {/* Antenna */}
        <group ref={antenna} position={[0, 0.45, 0]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.3, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh ref={antennaTip} position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial
              color={emotion === 'happy' ? '#fbbf24' : emotion === 'stressed' ? '#ef4444' : '#10b981'}
              emissive={emotion === 'happy' ? '#fbbf24' : emotion === 'stressed' ? '#ef4444' : '#10b981'}
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Ears */}
        <mesh position={[-0.5, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
          <meshStandardMaterial color="#10b981" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
          <meshStandardMaterial color="#10b981" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Arms — as groups for wave animation */}
      <group ref={leftArm} position={[-0.7, 0.1, 0]} rotation={[0, 0, 0.4]}>
        <mesh position={[0, -0.4, 0]}>
          <capsuleGeometry args={[0.13, 0.55, 8, 16]} />
          <meshStandardMaterial color="#06b6d4" metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.8, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.7, 0.1, 0]} rotation={[0, 0, -0.4]}>
        <mesh position={[0, -0.4, 0]}>
          <capsuleGeometry args={[0.13, 0.55, 8, 16]} />
          <meshStandardMaterial color="#06b6d4" metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.8, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>

      {/* Legs — as groups for walking swing animation */}
      <group ref={leftLeg} position={[-0.3, -1.1, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.13, 0.5, 8, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
        </mesh>
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[0, -0.4, 0.1]} castShadow>
          <meshStandardMaterial color="#0f172a" metalness={0.5} />
        </RoundedBox>
      </group>
      <group ref={rightLeg} position={[0.3, -1.1, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.13, 0.5, 8, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
        </mesh>
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[0, -0.4, 0.1]} castShadow>
          <meshStandardMaterial color="#0f172a" metalness={0.5} />
        </RoundedBox>
      </group>
    </group>
  );
}

// =====================
// Main component
// =====================
export default function Robot3D({
  emotion = 'neutral',
  mode = 'idle',
  targetLocation = 'center',
}: {
  emotion?: Emotion;
  mode?: Mode;
  targetLocation?: string;
}) {
  const light = EMOTION_LIGHT[emotion];

  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.8, 8], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={light.ambient} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={light.key}
        color={light.keyColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.4} color={light.fill} />
      {/* Subtle rim light */}
      <directionalLight position={[0, 2, -5]} intensity={0.3} color="#a78bfa" />

      <Room emotion={emotion} />

      <Float speed={mode === 'thinking' ? 0.5 : 1.5} rotationIntensity={0.2} floatIntensity={mode === 'thinking' ? 0.3 : 0.6}>
        <RobotMesh emotion={emotion} mode={mode} targetLocation={targetLocation} />
      </Float>

      {/* Sparkles around robot when happy */}
      {emotion === 'happy' && (
        <Sparkles count={40} scale={5} size={4} speed={0.5} color="#fbbf24" />
      )}
      {/* Floating dust particles when sad */}
      {emotion === 'sad' && (
        <Sparkles count={25} scale={6} size={2} speed={0.2} color="#60a5fa" opacity={0.4} />
      )}

      <ContactShadows
        position={[0, -1.6, 0]}
        opacity={0.5}
        scale={8}
        blur={2}
        far={4}
        color="#000000"
      />
      <Environment preset="apartment" />

      {/* Camera orbit — wider so we can see the whole room */}
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.05}
        minAzimuthAngle={-Math.PI / 2}
        maxAzimuthAngle={Math.PI / 2}
        enableZoom
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}

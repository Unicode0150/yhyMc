//第一段

import * as THREE from 'three';

// ============ 场景 ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 60, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 0);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

// ============ 灯光 ============
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
dirLight.position.set(20, 40, 10);
scene.add(dirLight);

// ============ 256色方块 ============
const BLOCK_PALETTE = [];
BLOCK_PALETTE.push({ name: '草地', color: 0x7CFC00, type: 'grass' });
BLOCK_PALETTE.push({ name: '泥土', color: 0x8B4513, type: 'dirt' });
BLOCK_PALETTE.push({ name: '石头', color: 0x808080, type: 'stone' });
BLOCK_PALETTE.push({ name: '木头', color: 0x8B5A2B, type: 'wood' });
BLOCK_PALETTE.push({ name: '树叶', color: 0x2E8B57, type: 'leaf' });
BLOCK_PALETTE.push({ name: '基岩', color: 0x333333, type: 'bedrock' });
for (let i = 0; i < 250; i++) {
    const hue = (i * 360 / 250) % 360;
    const sat = 0.7 + (i % 5) * 0.06;
    const light = 0.45 + (i % 3) * 0.1;
    const color = new THREE.Color().setHSL(hue / 360, sat, light);
    BLOCK_PALETTE.push({ name: `色块${i}`, color: color.getHex(), type: `custom_${i}` });
}

const materials = {};
BLOCK_PALETTE.forEach(b => {
    materials[b.type] = new THREE.MeshLambertMaterial({ color: b.color });
});

// ============ 世界 ============
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 3;
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

const MAX_PER_TYPE = 8000;
const instancedMeshes = {};

BLOCK_PALETTE.forEach(b => {
    const mesh = new THREE.InstancedMesh(blockGeometry, materials[b.type], MAX_PER_TYPE);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    instancedMeshes[b.type] = mesh;
});

const blockData = new Map();
const chunkBlocks = new Map();
const playerBlocks = new Set();

let rebuildPending = false;
function scheduleRebuild() {
    if (rebuildPending) return;
    rebuildPending = true;
    requestAnimationFrame(() => {
        rebuildPending = false;
        doRebuild();
    });
}

function doRebuild() {
    const counters = {};
    BLOCK_PALETTE.forEach(b => {
        instancedMeshes[b.type].count = 0;
        counters[b.type] = 0;
    });
    
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(1, 1, 1);
    
    blockData.forEach((type, key) => {
        const mesh = instancedMeshes[type];
        if (!mesh) return;
        const idx = counters[type];
        if (idx >= MAX_PER_TYPE) return;
        
        const parts = key.split(',');
        _p.set(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(idx, _m);
        counters[type] = idx + 1;
    });
    
    BLOCK_PALETTE.forEach(b => {
        const mesh = instancedMeshes[b.type];
        mesh.count = counters[b.type];
        mesh.instanceMatrix.needsUpdate = true;
    });
    
    // 更新所有边框
    rebuildEdges();
}

// ============ 方块边框（用稍大的深色立方体包裹，视觉上形成边框）============
const edgeMaterials = {};
BLOCK_PALETTE.forEach(b => {
    const origColor = new THREE.Color(b.color);
    const darkColor = origColor.clone().multiplyScalar(0.3);
    edgeMaterials[b.type] = new THREE.MeshBasicMaterial({
        color: darkColor,
        side: THREE.BackSide   // 只显示外表面，内表面不渲染
    });
});

const edgeGeometries = {};
BLOCK_PALETTE.forEach(b => {
    edgeGeometries[b.type] = new THREE.BoxGeometry(1.02, 1.02, 1.02);
});

const edgeMeshes = {};
BLOCK_PALETTE.forEach(b => {
    const edges = new THREE.InstancedMesh(edgeGeometries[b.type], edgeMaterials[b.type], MAX_PER_TYPE);
    edges.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    edges.count = 0;
    edges.frustumCulled = false;
    scene.add(edges);
    edgeMeshes[b.type] = edges;
});

function rebuildEdges() {
    const counters = {};
    BLOCK_PALETTE.forEach(b => {
        edgeMeshes[b.type].count = 0;
        counters[b.type] = 0;
    });
    
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(1, 1, 1);
    
    blockData.forEach((type, key) => {
        const mesh = edgeMeshes[type];
        if (!mesh) return;
        const idx = counters[type];
        if (idx >= MAX_PER_TYPE) return;
        
        const parts = key.split(',');
        _p.set(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(idx, _m);
        counters[type] = idx + 1;
    });
    
    BLOCK_PALETTE.forEach(b => {
        const mesh = edgeMeshes[b.type];
        mesh.count = counters[b.type];
        mesh.instanceMatrix.needsUpdate = true;
    });
}

// ============ 聊天框 ============
const chatBox = document.getElementById('chatBox');
const MAX_CHAT = 5;
function addChat(text, type = 'info') {
    if (!chatBox) return;
    const el = document.createElement('div');
    el.className = 'chatMsg ' + type;
    el.textContent = text;
    chatBox.appendChild(el);
    while (chatBox.children.length > MAX_CHAT) {
        chatBox.removeChild(chatBox.firstChild);
    }
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 600);
    }, 4000);
}

// ============ 噪声 ============
function rand(x, z, seed) {
    const n = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x, z, scale, seed) {
    const sx = x / scale, sz = z / scale;
    const x0 = Math.floor(sx), z0 = Math.floor(sz);
    const fx = sx - x0, fz = sz - z0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const n00 = rand(x0, z0, seed);
    const n10 = rand(x0 + 1, z0, seed);
    const n01 = rand(x0, z0 + 1, seed);
    const n11 = rand(x0 + 1, z0 + 1, seed);
    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return nx0 * (1 - v) + nx1 * v;
}

function getTerrainHeight(x, z) {
    let h = 0;
    h += smoothNoise(x, z, 32, 100) * 4;
    h += smoothNoise(x, z, 16, 200) * 2;
    h += smoothNoise(x, z, 8, 300) * 1;
    return Math.floor(h) + 1;
}

function shouldGenerateTree(x, z) {
    if (rand(x, z, 999) > 0.9) {
        const near = [
            [x-2,z],[x+2,z],[x,z-2],[x,z+2],
            [x-1,z-1],[x-1,z+1],[x+1,z-1],[x+1,z+1]
        ];
        for (const [nx, nz] of near) {
            if (rand(nx, nz, 999) > 0.9) return false;
        }
        return true;
    }
    return false;
}

//第二段

// ============ 方块数据操作 ============
function addBlockData(x, y, z, type, isPlayer = false) {
    const key = `${x},${y},${z}`;
    if (blockData.has(key)) return false;
    blockData.set(key, type);
    if (isPlayer) playerBlocks.add(key);
    return true;
}

function removeBlockData(x, y, z) {
    const key = `${x},${y},${z}`;
    if (!blockData.has(key)) return false;
    blockData.delete(key);
    playerBlocks.delete(key);
    return true;
}

// ============ 地下结构生成 ============
function rand3(x, y, z, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    return n - Math.floor(n);
}

// 洞穴：已关闭
function isCave(x, y, z, surfaceY) {
    return false;
}

// 判断某个位置是否生成矿石
function getOreType(x, y, z, currentType) {
    if (currentType !== 'stone') return null;
    if (y < -8) return null;
    
    const r1 = rand3(x, y, z, 1000);
    const r2 = rand3(x, y, z, 2000);
    const r3 = rand3(x, y, z, 3000);
    
    if (y < -6 && r1 > 0.9998) return 'custom_170';
    if (y < -4 && r1 > 0.9995) return 'custom_40';
    if (y < -2 && r2 > 0.992) return 'custom_160';
    if (r3 > 0.985) return 'custom_200';
    
    return null;
}

// 生成地下遗迹
function generateDungeon(cx, cz, keys) {
    const dungeonNoise = rand(cx, cz, 5555);
    if (dungeonNoise < 0.96) return;
    
    const bx = cx * CHUNK_SIZE + 8 + Math.floor(rand(cx, cz, 1111) * 6 - 3);
    const bz = cz * CHUNK_SIZE + 8 + Math.floor(rand(cx, cz, 2222) * 6 - 3);
    const by = -6;
    
    const roomW = 5, roomH = 3, roomD = 5;
    
    for (let x = bx - Math.floor(roomW/2); x <= bx + Math.floor(roomW/2); x++) {
        for (let y = by - 1; y <= by + roomH; y++) {
            for (let z = bz - Math.floor(roomD/2); z <= bz + Math.floor(roomD/2); z++) {
                const key = `${x},${y},${z}`;
                if (blockData.has(key)) {
                    blockData.delete(key);
                    keys.delete(key);
                }
            }
        }
    }
    
    const treasureKey = `${bx},${by},${bz}`;
    if (addBlockData(bx, by, bz, 'custom_240')) keys.add(treasureKey);
    
    const torchPositions = [
        [bx - 2, by, bz - 2],
        [bx + 2, by, bz - 2],
        [bx - 2, by, bz + 2],
        [bx + 2, by, bz + 2]
    ];
    torchPositions.forEach(([tx, ty, tz]) => {
        const key = `${tx},${ty},${tz}`;
        if (addBlockData(tx, ty, tz, 'custom_50')) keys.add(key);
    });
}

// ============ 区块生成 ============
function generateChunk(cx, cz) {
    const ck = `${cx},${cz}`;
    if (chunkBlocks.has(ck)) return;
    
    const keys = new Set();
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let dx = 0; dx < CHUNK_SIZE; dx++) {
        for (let dz = 0; dz < CHUNK_SIZE; dz++) {
            const wx = startX + dx;
            const wz = startZ + dz;
            const sy = getTerrainHeight(wx, wz);

            // ===== 地表层 =====
            // 草地
            if (addBlockData(wx, sy, wz, 'grass')) keys.add(`${wx},${sy},${wz}`);
            
            // 泥土（3 层）
            for (let y = sy - 1; y >= sy - 3; y--) {
                if (addBlockData(wx, y, wz, 'dirt')) keys.add(`${wx},${y},${wz}`);
            }
            
            // ===== 地下石头层（从 sy-4 到 -9） =====
            const stoneStart = sy - 4;
            const stoneEnd = -9;
            for (let y = stoneStart; y >= stoneEnd; y--) {
                // 洞穴（当前关闭）
                if (isCave(wx, y, wz, sy)) continue;
                
                // 矿石判断
                const oreType = getOreType(wx, y, wz, 'stone');
                const blockType = oreType || 'stone';
                
                if (addBlockData(wx, y, wz, blockType)) {
                    keys.add(`${wx},${y},${wz}`);
                }
            }
            
            // ===== 基岩层 =====
            if (addBlockData(wx, -10, wz, 'bedrock')) keys.add(`${wx},-10,${wz}`);

            // 树
            if (shouldGenerateTree(wx, wz) && 
                dx >= 1 && dx <= CHUNK_SIZE - 2 && 
                dz >= 1 && dz <= CHUNK_SIZE - 2) {
                generateTree(wx, sy + 1, wz, keys);
            }
        }
    }
    
    // 遗迹
    generateDungeon(cx, cz, keys);
    
    chunkBlocks.set(ck, keys);
}

function generateTree(bx, by, bz, keys) {
    for (let i = 0; i < 4; i++) {
        if (addBlockData(bx, by + i, bz, 'wood')) keys.add(`${bx},${by+i},${bz}`);
    }
    const leafs = [
        [-1,2,0],[1,2,0],[0,2,-1],[0,2,1],
        [-1,3,-1],[-1,3,0],[-1,3,1],
        [1,3,-1],[1,3,0],[1,3,1],
        [0,3,-1],[0,3,1],
        [0,4,0],[-1,4,0],[1,4,0],[0,4,-1],[0,4,1],
        [0,5,0]
    ];
    for (const [dx, dy, dz] of leafs) {
        const k = `${bx+dx},${by+dy},${bz+dz}`;
        if (addBlockData(bx+dx, by+dy, bz+dz, 'leaf')) keys.add(k);
    }
}

// ============ 区块更新（重写：不再卸载方块，只清理旧区块记录） ============
let lastChunkCx = 9999, lastChunkCz = 9999;

function updateChunks() {
    const ccx = Math.floor(camera.position.x / CHUNK_SIZE);
    const ccz = Math.floor(camera.position.z / CHUNK_SIZE);
    
    let changed = false;

    // 加载视野内所有区块
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
            const cx = ccx + dx;
            const cz = ccz + dz;
            const ck = `${cx},${cz}`;
            if (!chunkBlocks.has(ck)) {
                generateChunk(cx, cz);
                changed = true;
            }
        }
    }

    // 卸载远处区块
    if (ccx !== lastChunkCx || ccz !== lastChunkCz) {
        const toRemove = [];
        chunkBlocks.forEach((keys, ck) => {
            const [cx, cz] = ck.split(',').map(Number);
            if (Math.abs(cx - ccx) > RENDER_DISTANCE + 1 || 
                Math.abs(cz - ccz) > RENDER_DISTANCE + 1) {
                toRemove.push({ ck, keys });
            }
        });
        
        toRemove.forEach(({ ck, keys }) => {
            keys.forEach(k => {
                if (!playerBlocks.has(k)) {
                    blockData.delete(k);
                }
            });
            chunkBlocks.delete(ck);
            changed = true;
        });
        
        lastChunkCx = ccx;
        lastChunkCz = ccz;
        const el = document.getElementById('chunkInfo');
        if (el) el.textContent = `${ccx},${ccz}`;
    }

    if (changed) scheduleRebuild();
}

// ============ 初始化 ============
for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        generateChunk(dx, dz);
    }
}
lastChunkCx = 0;
lastChunkCz = 0;
doRebuild();

// ============ 出生点：找最高的地面 ============
let spawnY = 20;
for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
        const h = getTerrainHeight(dx, dz);
        if (h > spawnY - 20) spawnY = h + 6;
    }
}
camera.position.set(0, spawnY, 0);

// ============ 碰撞 ============
const PLAYER_WIDTH = 0.8;
const PLAYER_HEIGHT = 1.8;
const PLAYER_EYE = 1.6;
const HALF_W = PLAYER_WIDTH / 2;

function isSolid(x, y, z) {
    return blockData.has(`${x},${y},${z}`);
}


function collidesAt(px, py, pz) {
    // 旁观模式：没有任何碰撞
    if (window.spectatorMode === true) return false;
    
    // 玩家体积：宽 0.8、高 1.8
    const r = HALF_W - 0.001;
    
    const minX = Math.floor(px - r);
    const maxX = Math.floor(px + r);
    const minY = Math.floor(py + 0.001);
    const maxY = Math.floor(py + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(pz - r);
    const maxZ = Math.floor(pz + r);
    
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                if (isSolid(x, y, z)) return true;
            }
        }
    }
    return false;
}

function moveWithCollision(dx, dy, dz) {
    // 旁观模式：直接移动，不做任何碰撞
    if (window.spectatorMode === true) {
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
        return;
    }
    
    const pos = camera.position;
    const bodyY = pos.y - PLAYER_EYE;
    
    // 如果当前已经卡在方块里 → 允许自由移动脱困
    if (collidesAt(pos.x, bodyY, pos.z)) {
        pos.x += dx;
        pos.y += dy;
        pos.z += dz;
        if (dy <= 0) pos.y += 0.02;
        return;
    }
    
    const STEP = 0.02;
    
    // X 轴
    if (dx !== 0) {
        const steps = Math.max(1, Math.ceil(Math.abs(dx) / STEP));
        const stepX = dx / steps;
        for (let i = 0; i < steps; i++) {
            const nx = pos.x + stepX;
            if (!collidesAt(nx, bodyY, pos.z)) pos.x = nx;
            else break;
        }
    }
    
    // Z 轴
    if (dz !== 0) {
        const steps = Math.max(1, Math.ceil(Math.abs(dz) / STEP));
        const stepZ = dz / steps;
        for (let i = 0; i < steps; i++) {
            const nz = pos.z + stepZ;
            if (!collidesAt(pos.x, bodyY, nz)) pos.z = nz;
            else break;
        }
    }
    
    // Y 轴
    if (dy !== 0) {
        const steps = Math.max(1, Math.ceil(Math.abs(dy) / STEP));
        const stepY = dy / steps;
        for (let i = 0; i < steps; i++) {
            const ny = pos.y + stepY;
            if (!collidesAt(pos.x, ny - PLAYER_EYE, pos.z)) pos.y = ny;
            else break;
        }
    }
}

let velocityY = 0;
const GRAVITY = -25;
const JUMP = 8.5;

function isOnGround() {
    const pos = camera.position;
    const bodyY = pos.y - PLAYER_EYE;
    return collidesAt(pos.x, bodyY - 0.05, pos.z);
}

function isPlayerStuck() {
    const pos = camera.position;
    return collidesAt(pos.x, pos.y - PLAYER_EYE, pos.z);
}

// ============ 灵敏度/速度倍率（由输入框控制） ============
let sensMultiplier = 1.0;
let speedMultiplier = 1.0;
let placeMultiplier = 1.0;
let breakMultiplier = 1.0;
const BASE_SENS = 0.006;
const BASE_SPEED = 5.5;

function getTouchSensitivity() {
    return BASE_SENS * sensMultiplier;
}
function getMoveSpeed() {
    return BASE_SPEED * speedMultiplier;
}


//第三段


// ============ 普通按钮绑定 ============
function bindButton(el, onClick) {
    if (!el) return;
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    el.addEventListener('touchstart', (e) => {
        e.stopPropagation(); e.preventDefault(); onClick();
    }, { passive: false });
}

// ============ 射线检测 ============
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);
let selectedBlockType = 'grass';

const hlGeo = new THREE.BoxGeometry(1.03, 1.03, 1.03);
const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.6 });
const hlMesh = new THREE.Mesh(hlGeo, hlMat);
hlMesh.visible = false;
scene.add(hlMesh);

function getTargetHit() {
    raycaster.setFromCamera(centerScreen, camera);
    const meshes = [];
    BLOCK_PALETTE.forEach(b => {
        const m = instancedMeshes[b.type];
        if (m.count > 0) meshes.push(m);
    });
    const intersects = raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;
    const hit = intersects[0];
    if (hit.distance > 7) return null;
    return hit;
}

function getBlockPosFromHit(hit) {
    const point = hit.point.clone();
    const normal = hit.face.normal.clone();
    const center = point.sub(normal.clone().multiplyScalar(0.5));
    return {
        x: Math.round(center.x),
        y: Math.round(center.y),
        z: Math.round(center.z)
    };
}

function updateHighlight() {
    const hit = getTargetHit();
    if (hit) {
        const bp = getBlockPosFromHit(hit);
        hlMesh.position.set(bp.x, bp.y, bp.z);
        hlMesh.visible = true;
    } else {
        hlMesh.visible = false;
    }
}

function placeBlock() {
    const hit = getTargetHit();
    if (!hit) return;
    const bp = getBlockPosFromHit(hit);
    const n = hit.face.normal;
    const nx = bp.x + Math.round(n.x);
    const ny = bp.y + Math.round(n.y);
    const nz = bp.z + Math.round(n.z);
    
    const key = `${nx},${ny},${nz}`;
    if (blockData.has(key)) return;
    if (ny < -10 || ny > 80) return;
    
    addBlockData(nx, ny, nz, selectedBlockType, true);
    scheduleRebuild();
}

function breakBlock() {
    const hit = getTargetHit();
    if (!hit) return;
    const bp = getBlockPosFromHit(hit);
    if (bp.y <= -10) {
        addChat('基岩无法破坏', 'warn');
        return;
    }
    
    const key = `${bp.x},${bp.y},${bp.z}`;
    if (removeBlockData(bp.x, bp.y, bp.z)) {
        chunkBlocks.forEach(keys => {
            if (keys.has(key)) keys.delete(key);
        });
        scheduleRebuild();
    }
}

let hintTimer;
function showHint(text) {
    const el = document.getElementById('hint');
    if (!el) return;
    el.innerHTML = text;
    el.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}
setTimeout(() => {
    const el = document.getElementById('hint');
    if (el) el.style.opacity = '0';
}, 3500);

// ============ 快捷栏 ============
const HOTBAR_SIZE = 9;
const hotbarSlots = [];
for (let i = 0; i < HOTBAR_SIZE; i++) {
    hotbarSlots.push({ ...BLOCK_PALETTE[i] });
}
let selectedSlotIndex = 0;
selectedBlockType = hotbarSlots[0].type;

const hotbarEl = document.getElementById('hotbar');

function renderHotbar() {
    if (!hotbarEl) return;
    hotbarEl.innerHTML = '';
    hotbarSlots.forEach((slot, i) => {
        const el = document.createElement('div');
        el.className = 'slot' + (i === selectedSlotIndex ? ' selected' : '');
        if (slot) {
            const icon = document.createElement('div');
            icon.className = 'cubeIcon';
            icon.style.background = '#' + slot.color.toString(16).padStart(6, '0');
            el.appendChild(icon);
        }
        const num = document.createElement('div');
        num.className = 'slotNum';
        num.textContent = i + 1;
        el.appendChild(num);
        const h = (e) => { e.stopPropagation(); e.preventDefault(); selectSlot(i); };
        el.addEventListener('click', h);
        el.addEventListener('touchstart', h, { passive: false });
        hotbarEl.appendChild(el);
    });
}

function selectSlot(i) {
    selectedSlotIndex = i;
    if (hotbarSlots[i]) selectedBlockType = hotbarSlots[i].type;
    renderHotbar();
}
renderHotbar();

// ============ 背包 ============
const invPanel = document.getElementById('inventoryPanel');
const invGrid = document.getElementById('inventoryGrid');
const invBtn = document.getElementById('inventoryBtn');
const invClose = document.getElementById('inventoryClose');
const invScroll = document.getElementById('inventoryScroll');

let invRendered = false;
let invOpen = false;

function renderInventory() {
    if (!invGrid) return;
    invGrid.innerHTML = '';
    BLOCK_PALETTE.forEach(block => {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.title = block.name;
        const icon = document.createElement('div');
        icon.className = 'cubeIcon';
        icon.style.background = '#' + block.color.toString(16).padStart(6, '0');
        slot.appendChild(icon);
        const h = (e) => {
            e.stopPropagation(); e.preventDefault();
            hotbarSlots[selectedSlotIndex] = { ...block };
            renderHotbar();
            showHint(`已放入第 ${selectedSlotIndex + 1} 格: ${block.name}`);
        };
        slot.addEventListener('click', h);
        slot.addEventListener('touchstart', h, { passive: false });
        invGrid.appendChild(slot);
    });
    invRendered = true;
}

function openInventory() {
    if (!invPanel) return;
    invPanel.classList.remove('hidden');
    invOpen = true;
    if (invScroll) invScroll.scrollTop = 0;
    if (!invRendered) renderInventory();
}
function closeInventory() {
    if (!invPanel) return;
    invPanel.classList.add('hidden');
    invOpen = false;
}

bindButton(invBtn, () => {
    if (invOpen) closeInventory(); else openInventory();
});
bindButton(invClose, closeInventory);

if (invPanel) {
    invPanel.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    invPanel.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
}


//第四段


// ============ 键盘 ============
let yaw = 0, pitch = 0;
const pitchLimit = Math.PI / 2 - 0.01;
const ROT_SPEED = 1.8;

const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    Space: false, ShiftLeft: false, KeyQ: false, KeyE: false
};

let flyMode = false;
let spaceWasPressed = false;
let lastSpaceDownTime = 0;

// 放置/破坏按键按住状态
let keyCHolding = false;
let keyXHolding = false;
let mousePlaceHolding = false;
let mouseBreakHolding = false;

window.addEventListener('keydown', (e) => {
    if (invOpen) {
        if (e.code === 'ArrowDown') { if (invScroll) invScroll.scrollTop += 60; e.preventDefault(); return; }
        if (e.code === 'ArrowUp') { if (invScroll) invScroll.scrollTop -= 60; e.preventDefault(); return; }
        if (e.code === 'Escape') { closeInventory(); e.preventDefault(); return; }
    }
    if (e.code in keys) { keys[e.code] = true; e.preventDefault(); }
    
    if (e.code === 'Space' && !spaceWasPressed) {
        spaceWasPressed = true;
        const now = performance.now();
        if (now - lastSpaceDownTime < 300) {
            flyMode = !flyMode;
            velocityY = 0;
            addChat(flyMode ? '✈️ 飞行模式' : '🚶 行走模式', 'info');
            lastSpaceDownTime = 0;
        } else {
            lastSpaceDownTime = now;
        }
    }
    
    if (e.code === 'KeyX') {
        if (!keyXHolding) {
            keyXHolding = true;
        }
        e.preventDefault();
    }
    if (e.code === 'KeyC') {
        if (!keyCHolding) {
            keyCHolding = true;
        }
        e.preventDefault();
    }
    if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.replace('Digit', ''));
        if (n >= 1 && n <= 9) selectSlot(n - 1);
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code in keys) { keys[e.code] = false; e.preventDefault(); }
    if (e.code === 'Space') spaceWasPressed = false;
    if (e.code === 'KeyX') keyXHolding = false;
    if (e.code === 'KeyC') keyCHolding = false;
});

// ============ 触屏 ============
let lookId = null, lastPos = {x:0,y:0}, startPos = {x:0,y:0}, startTime = 0, moved = false;
let moveId = null, moveStart = {x:0,y:0}, moveNow = {x:0,y:0}, moving = false;

renderer.domElement.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && t.clientY > window.innerHeight * 0.45 && moveId === null) {
            moveId = t.identifier;
            moveStart = { x: t.clientX, y: t.clientY };
            moveNow = { x: t.clientX, y: t.clientY };
            moving = true;
        } else if (lookId === null) {
            lookId = t.identifier;
            lastPos = { x: t.clientX, y: t.clientY };
            startPos = { x: t.clientX, y: t.clientY };
            startTime = performance.now();
            moved = false;
        }
    }
}, { passive: false });

renderer.domElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
            const dx = t.clientX - lastPos.x;
            const dy = t.clientY - lastPos.y;
            if (Math.abs(t.clientX - startPos.x) > 5 || Math.abs(t.clientY - startPos.y) > 5) moved = true;
            const s = getTouchSensitivity();
            yaw -= dx * s;
            pitch -= dy * s;
            pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
            lastPos = { x: t.clientX, y: t.clientY };
        }
        if (t.identifier === moveId) {
            moveNow = { x: t.clientX, y: t.clientY };
        }
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
            const dur = performance.now() - startTime;
            if (!moved) {
                if (dur < 300) placeBlock();
                else if (dur > 400) breakBlock();
            }
            lookId = null;
        }
        if (t.identifier === moveId) { moveId = null; moving = false; }
    }
}, { passive: false });

renderer.domElement.addEventListener('touchcancel', (e) => {
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) lookId = null;
        if (t.identifier === moveId) { moveId = null; moving = false; }
    }
});

// 鼠标
let mDown = false, mStart = {x:0,y:0}, mTime = 0, mMoved = false;

renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.target !== renderer.domElement) return;
    if (e.button === 0) {
        mDown = true;
        lastPos = { x: e.clientX, y: e.clientY };
        mStart = { x: e.clientX, y: e.clientY };
        mTime = performance.now();
        mMoved = false;
        placeBlock();
        mousePlaceHolding = true;
    } else if (e.button === 2) {
        breakBlock();
        mouseBreakHolding = true;
    }
});
renderer.domElement.addEventListener('mousemove', (e) => {
    if (!mDown) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    if (Math.abs(e.clientX - mStart.x) > 5 || Math.abs(e.clientY - mStart.y) > 5) mMoved = true;
    const s = getTouchSensitivity();
    yaw -= dx * s;
    pitch -= dy * s;
    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
    lastPos = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        mDown = false;
        mousePlaceHolding = false;
    } else if (e.button === 2) {
        mouseBreakHolding = false;
    }
});
renderer.domElement.addEventListener('contextmenu', (e) => { e.preventDefault(); });

// ============ 主循环 ============
const posSpan = document.getElementById('pos');
const fpsSpan = document.getElementById('fps');
let prevTime = performance.now();
let lastChunkUpdate = 0;
let lastHighlightUpdate = 0;
let lastStuckCheck = 0;
let fpsCount = 0, fpsTime = 0;
let stuckWarnTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    let dt = (now - prevTime) / 1000;
    prevTime = now;
    if (dt > 0.05) dt = 0.05;

    fpsCount++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
        if (fpsSpan) fpsSpan.textContent = Math.round(fpsCount / fpsTime);
        fpsCount = 0;
        fpsTime = 0;
    }

    // 视角
    if (!invOpen) {
        if (keys.ArrowLeft || keys.KeyQ) yaw += ROT_SPEED * dt;
        if (keys.ArrowRight || keys.KeyE) yaw -= ROT_SPEED * dt;
        if (keys.ArrowUp) pitch += ROT_SPEED * dt;
        if (keys.ArrowDown) pitch -= ROT_SPEED * dt;
    }
    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // 移动
if (!invOpen) {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const mv = new THREE.Vector3(0, 0, 0);

    if (keys.KeyW) mv.add(forward);
    if (keys.KeyS) mv.sub(forward);
    if (keys.KeyD) mv.add(right);
    if (keys.KeyA) mv.sub(right);

    if (moving) {
        const dx = moveNow.x - moveStart.x;
        const dy = moveNow.y - moveStart.y;
        const dz = 15;
        if (Math.abs(dy) > dz) {
            if (dy < 0) mv.add(forward); else mv.sub(forward);
        }
        if (Math.abs(dx) > dz) {
            if (dx > 0) mv.add(right); else mv.sub(right);
        }
    }

    if (mv.length() > 0) {
        mv.y = 0;
        if (mv.length() > 0) mv.normalize();
    }

    const speed = getMoveSpeed();
    const hMove = mv.clone().multiplyScalar(speed * dt);
    
    // ====== 垂直运动（关键修复：防止抖动） ======
    let vMove = 0;
    const onGround = isOnGround();
    
    if (spectatorMode || flyMode) {
        if (keys.Space) vMove += speed * dt;
        if (keys.ShiftLeft) vMove -= speed * dt;
        velocityY = 0;
    } else {
        // 行走模式
        if (onGround) {
            // 站在地面：清零垂直速度，不做重力累积
            velocityY = 0;
            // 尝试让玩家吸附到地面
            // 如果当前脚下有方块，检查是否稍微悬空，吸附下去
            if (keys.Space) {
                velocityY = JUMP;   // 跳跃
                vMove = velocityY * dt;
            } else {
                vMove = 0;          // 不移动
            }
        } else {
            // 在空中：正常重力
            velocityY += GRAVITY * dt;
            if (velocityY < -12) velocityY = -12;   // 下降速度上限从 -30 改成 -12
            vMove = velocityY * dt;
        }
    }
    
    // 先做水平移动
    moveWithCollision(hMove.x, 0, hMove.z);
    
    // 再做垂直移动（避免水平碰撞影响垂直）
    if (vMove !== 0) {
        moveWithCollision(0, vMove, 0);
    }
    
    // 落地检测：如果在下落且脚部已触碰地面，停止下落
    if (!flyMode && velocityY < 0 && isOnGround()) {
        velocityY = 0;
    }
}
    
    // 卡墙检测
    if (now - lastStuckCheck > 400) {
        lastStuckCheck = now;
        if (isPlayerStuck()) {
            if (now - stuckWarnTime > 3000) {
                addChat('⚠️ 你卡在方块里了！请破坏周围方块或移动到空旷处', 'warn');
                stuckWarnTime = now;
            }
        }
    }

    if (posSpan) posSpan.textContent = `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;

    if (now - lastChunkUpdate > 400) {
        updateChunks();
        lastChunkUpdate = now;
    }

    if (now - lastHighlightUpdate > 80) {
        updateHighlight();
        lastHighlightUpdate = now;
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


//第五段


// ============================================================
// 【整合追加模块】人物模型 + 视角切换 + 数值输入框 + 倍率控制 + 旁观模式
// ============================================================

// ---------- 通用：长按拖动函数 ----------
function makeDraggable(el, storageKey) {
    let holdTimer = null;
    let isPressed = false;
    let isDragging = false;
    let startX = 0, startY = 0;
    let elStartLeft = 0, elStartTop = 0;
    const HOLD_DELAY = 350;
    
    // 恢复上次位置
    if (storageKey) {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const pos = JSON.parse(saved);
                el.style.left = pos.left + 'px';
                el.style.top = pos.top + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                el.style.transform = 'none';
            }
        } catch (e) {}
    }
    
    function getXY(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }
    
    function start(e) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        if (isPressed) return;
        isPressed = true;
        const pt = getXY(e);
        startX = pt.x;
        startY = pt.y;
        const rect = el.getBoundingClientRect();
        elStartLeft = rect.left;
        elStartTop = rect.top;
        holdTimer = setTimeout(() => {
            isDragging = true;
            el.classList.add('dragging');
        }, HOLD_DELAY);
    }
    
    function move(e) {
        if (!isPressed) return;
        const pt = getXY(e);
        const dx = pt.x - startX;
        const dy = pt.y - startY;
        if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
            if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
            isPressed = false;
            return;
        }
        if (isDragging) {
            if (e.cancelable) e.preventDefault();
            let nl = elStartLeft + dx;
            let nt = elStartTop + dy;
            nl = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, nl));
            nt = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, nt));
            el.style.left = nl + 'px';
            el.style.top = nt + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.transform = 'none';
        }
    }
    
    function end(e) {
        if (!isPressed) return;
        isPressed = false;
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (isDragging) {
            el.classList.remove('dragging');
            if (storageKey) {
                const rect = el.getBoundingClientRect();
                try {
                    localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
                } catch (e) {}
            }
            isDragging = false;
        }
    }
    
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- A. 人物模型（虚空配色） ----------
const PX = 1 / 16;
const MODEL_SCALE = 1.8 / 2.0;

const matVoidBlack = new THREE.MeshLambertMaterial({ color: 0x1A1A1A });
const matVoidWhite = new THREE.MeshLambertMaterial({ color: 0xE8E8E8 });
const matVoidPurple = new THREE.MeshLambertMaterial({ color: 0x8B5CF6 });
const matVoidPurpleDark = new THREE.MeshLambertMaterial({ color: 0x5B21B6 });
const matVoidGray = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });

const playerModel = new THREE.Group();

// 头
const headGroup = new THREE.Group();
const headBox = new THREE.Mesh(new THREE.BoxGeometry(8*PX, 8*PX, 8*PX), matVoidWhite);
headGroup.add(headBox);
const eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.5*PX, 2*PX, 0.5*PX), matVoidPurple);
eyeL.position.set(-1.5*PX, 0.5*PX, 4*PX + 0.1*PX);
headGroup.add(eyeL);
const eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.5*PX, 2*PX, 0.5*PX), matVoidPurple);
eyeR.position.set(1.5*PX, 0.5*PX, 4*PX + 0.1*PX);
headGroup.add(eyeR);
const hairTop = new THREE.Mesh(new THREE.BoxGeometry(8.2*PX, 1*PX, 8.2*PX), matVoidBlack);
hairTop.position.set(0, 4*PX, 0);
headGroup.add(hairTop);
const hairBack = new THREE.Mesh(new THREE.BoxGeometry(8.2*PX, 6*PX, 1*PX), matVoidBlack);
hairBack.position.set(0, -0.5*PX, -4*PX);
headGroup.add(hairBack);
const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(1*PX, 6*PX, 8.2*PX), matVoidBlack);
hairSideL.position.set(-4*PX, -0.5*PX, 0);
headGroup.add(hairSideL);
const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(1*PX, 6*PX, 8.2*PX), matVoidBlack);
hairSideR.position.set(4*PX, -0.5*PX, 0);
headGroup.add(hairSideR);
headGroup.position.set(0, 28*PX, 0);
playerModel.add(headGroup);

// 身体
const torso = new THREE.Mesh(new THREE.BoxGeometry(8*PX, 12*PX, 4*PX), matVoidBlack);
torso.position.set(0, 18*PX, 0);
playerModel.add(torso);
const chestDeco = new THREE.Mesh(new THREE.BoxGeometry(4*PX, 4*PX, 0.3*PX), matVoidPurpleDark);
chestDeco.position.set(0, 18*PX, 2*PX + 0.15*PX);
playerModel.add(chestDeco);

// 手臂
const armL = new THREE.Mesh(new THREE.BoxGeometry(4*PX, 12*PX, 4*PX), matVoidGray);
armL.position.set(-6*PX, 18*PX, 0);
playerModel.add(armL);
const handL = new THREE.Mesh(new THREE.BoxGeometry(4.05*PX, 2*PX, 4.05*PX), matVoidPurple);
handL.position.set(-6*PX, 12*PX, 0);
playerModel.add(handL);
const armR = new THREE.Mesh(new THREE.BoxGeometry(4*PX, 12*PX, 4*PX), matVoidGray);
armR.position.set(6*PX, 18*PX, 0);
playerModel.add(armR);
const handR = new THREE.Mesh(new THREE.BoxGeometry(4.05*PX, 2*PX, 4.05*PX), matVoidPurple);
handR.position.set(6*PX, 12*PX, 0);
playerModel.add(handR);

// 腿
const legL = new THREE.Mesh(new THREE.BoxGeometry(4*PX, 12*PX, 4*PX), matVoidBlack);
legL.position.set(-2*PX, 6*PX, 0);
playerModel.add(legL);
const footL = new THREE.Mesh(new THREE.BoxGeometry(4.05*PX, 1*PX, 4.05*PX), matVoidPurpleDark);
footL.position.set(-2*PX, 0.5*PX, 0);
playerModel.add(footL);
const legR = new THREE.Mesh(new THREE.BoxGeometry(4*PX, 12*PX, 4*PX), matVoidBlack);
legR.position.set(2*PX, 6*PX, 0);
playerModel.add(legR);
const footR = new THREE.Mesh(new THREE.BoxGeometry(4.05*PX, 1*PX, 4.05*PX), matVoidPurpleDark);
footR.position.set(2*PX, 0.5*PX, 0);
playerModel.add(footR);

playerModel.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
playerModel.visible = false;
scene.add(playerModel);

// ---------- B. 视角切换按钮（左上角，可拖动） ----------
let viewMode = 'first';
const THIRD_PERSON_DISTANCE = 4.0;

const viewBtn = document.createElement('div');
viewBtn.className = 'mc-btn';
viewBtn.style.position = 'absolute';
viewBtn.style.top = '10px';
viewBtn.style.left = '10px';
viewBtn.style.zIndex = '200';
viewBtn.textContent = '👁️ 第一人称';
document.body.appendChild(viewBtn);
makeDraggable(viewBtn, 'viewBtnPos');

function switchView() {
    if (viewMode === 'first') {
        viewMode = 'third';
        playerModel.visible = true;
        viewBtn.textContent = '👁️ 第三人称';
        addChat('👁️ 切换到第三人称', 'info');
    } else {
        viewMode = 'first';
        playerModel.visible = false;
        viewBtn.textContent = '👁️ 第一人称';
        addChat('👁️ 切换到第一人称', 'info');
    }
}

viewBtn.addEventListener('click', (e) => { e.stopPropagation(); switchView(); });
viewBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation(); e.preventDefault(); switchView();
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') { switchView(); e.preventDefault(); }
});

// ---------- C. 设置总开关按钮（右上角，可拖动） ----------
const settingsBtn = document.createElement('div');
settingsBtn.className = 'mc-btn';
settingsBtn.style.position = 'absolute';
settingsBtn.style.top = '10px';
settingsBtn.style.right = '10px';
settingsBtn.style.zIndex = '250';
settingsBtn.style.fontSize = '20px';
settingsBtn.textContent = '⚙️';
document.body.appendChild(settingsBtn);
makeDraggable(settingsBtn, 'settingsBtnPos');

// ---------- D. 设置弹窗（屏幕中心） ----------
const settingsModal = document.createElement('div');
settingsModal.className = 'settings-modal';
document.body.appendChild(settingsModal);

const modalTitle = document.createElement('div');
modalTitle.className = 'modal-title';
modalTitle.textContent = '⚙️ 设置';
settingsModal.appendChild(modalTitle);

function createNumberInput(label, defaultValue, step, onApply) {
    const row = document.createElement('div');
    row.className = 'input-row';
    
    const span = document.createElement('span');
    span.textContent = label;
    row.appendChild(span);
    
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = step;
    input.value = defaultValue;
    row.appendChild(input);
    
    row.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    row.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    input.addEventListener('keydown', e => e.stopPropagation());
    input.addEventListener('keyup', e => e.stopPropagation());
    
    function apply() {
        let v = parseFloat(input.value);
        if (isNaN(v) || v < 1) v = 1;
        onApply(v);
        input.value = v;
    }
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
    apply();
    
    settingsModal.appendChild(row);
    return input;
}

createNumberInput('🎯 灵敏度', 1, 0.1, (v) => { sensMultiplier = v; });
createNumberInput('👟 速度', 1, 0.1, (v) => { speedMultiplier = v; });
createNumberInput('🔨 放置倍率', 1, 1, (v) => { placeMultiplier = v; });
createNumberInput('⛏️ 破坏倍率', 1, 1, (v) => { breakMultiplier = v; });

const closeBtn = document.createElement('div');
closeBtn.className = 'close-btn';
closeBtn.textContent = '✕ 关闭';
settingsModal.appendChild(closeBtn);

let settingsOpen = false;
function openSettings() {
    settingsOpen = true;
    settingsModal.classList.add('show');
    settingsModal.style.display = 'flex';
    requestAnimationFrame(() => {
        settingsModal.style.opacity = '1';
        settingsModal.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    settingsBtn.classList.add('active');
}
function closeSettings() {
    settingsOpen = false;
    settingsModal.style.opacity = '0';
    settingsModal.style.transform = 'translate(-50%, -50%) scale(0.9)';
    settingsBtn.classList.remove('active');
    setTimeout(() => {
        if (!settingsOpen) {
            settingsModal.classList.remove('show');
            settingsModal.style.display = 'none';
        }
    }, 200);
}

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsOpen) closeSettings(); else openSettings();
});
settingsBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (settingsOpen) closeSettings(); else openSettings();
}, { passive: false });

closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeSettings(); });
closeBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation(); e.preventDefault(); closeSettings();
}, { passive: false });

settingsModal.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
settingsModal.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

// ---------- E. 旁观模式按钮（左上角，可拖动） ----------
window.spectatorMode = false;

const spectatorBtn = document.createElement('div');
spectatorBtn.className = 'mc-btn';
spectatorBtn.style.position = 'absolute';
spectatorBtn.style.top = '55px';
spectatorBtn.style.left = '10px';
spectatorBtn.style.zIndex = '200';
spectatorBtn.textContent = '👻 旁观模式';
document.body.appendChild(spectatorBtn);
makeDraggable(spectatorBtn, 'spectatorBtnPos');

function switchSpectator() {
    window.spectatorMode = !window.spectatorMode;
    if (window.spectatorMode) {
        spectatorBtn.textContent = '👻 旁观: 开';
        spectatorBtn.classList.add('active');
        addChat('👻 旁观模式：可穿墙、无重力', 'info');
    } else {
        spectatorBtn.textContent = '👻 旁观模式';
        spectatorBtn.classList.remove('active');
        addChat('👻 已关闭旁观模式', 'info');
    }
}

spectatorBtn.addEventListener('click', (e) => { e.stopPropagation(); switchSpectator(); });
spectatorBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation(); e.preventDefault(); switchSpectator();
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') { switchSpectator(); e.preventDefault(); }
});

// ---------- F. 高频循环：按倍率放置/破坏 ----------
let placeAccumulator = 0;
let breakAccumulator = 0;
let lastLoopTime = performance.now() / 1000;
const BASE_RATE = 10;

function highSpeedLoop() {
    requestAnimationFrame(highSpeedLoop);
    
    const now = performance.now() / 1000;
    const dt = now - lastLoopTime;
    lastLoopTime = now;
    
    if (keyCHolding || mousePlaceHolding) {
        const rate = Math.max(1, placeMultiplier) * BASE_RATE;
        placeAccumulator += rate * dt;
        const MAX_PER_FRAME = 50;
        let count = Math.min(Math.floor(placeAccumulator), MAX_PER_FRAME);
        placeAccumulator -= count;
        for (let i = 0; i < count; i++) {
            placeBlock();
        }
    } else {
        placeAccumulator = 0;
    }
    
    if (keyXHolding || mouseBreakHolding) {
        const rate = Math.max(1, breakMultiplier) * BASE_RATE;
        breakAccumulator += rate * dt;
        const MAX_PER_FRAME = 50;
        let count = Math.min(Math.floor(breakAccumulator), MAX_PER_FRAME);
        breakAccumulator -= count;
        for (let i = 0; i < count; i++) {
            breakBlock();
        }
    } else {
        breakAccumulator = 0;
    }
}
highSpeedLoop();

// ---------- G. 渲染钩子：人物模型 + 第三人称相机 ----------
const _originalRender = renderer.render.bind(renderer);

renderer.render = function(sceneArg, cameraArg) {
    const footY = camera.position.y - PLAYER_EYE;
    playerModel.position.set(camera.position.x, footY, camera.position.z);
    playerModel.rotation.y = yaw + Math.PI;

    if (viewMode === 'first') {
        _originalRender(sceneArg, cameraArg);
        return;
    }

    const realX = camera.position.x;
    const realY = camera.position.y;
    const realZ = camera.position.z;

    const backX = Math.sin(yaw) * THIRD_PERSON_DISTANCE;
    const backZ = Math.cos(yaw) * THIRD_PERSON_DISTANCE;
    const targetX = realX + backX;
    const targetY = realY + 0.6;
    const targetZ = realZ + backZ;

    let camX = realX, camY = realY, camZ = realZ;
    const dx = targetX - realX;
    const dy = targetY - realY;
    const dz = targetZ - realZ;
    const totalDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const steps = Math.ceil(totalDist / 0.15);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = realX + dx * t;
        const py = realY + dy * t;
        const pz = realZ + dz * t;
        if (collidesAt(px, py - PLAYER_EYE, pz)) break;
        camX = px; camY = py; camZ = pz;
    }

    camera.position.set(camX, camY, camZ);
    camera.rotation.order = 'YXZ';
    camera.lookAt(realX, realY - 0.3, realZ);

    _originalRender(sceneArg, cameraArg);

    camera.position.set(realX, realY, realZ);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
};

addChat('✅ 完整功能已加载 · 按 V 切换视角 · 按 G 旁观 · 点击 ⚙️ 设置', 'info');
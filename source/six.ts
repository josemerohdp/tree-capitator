/**
 * @license MIT
 * @author Six
 * @version 1.0.0
 * 
 * Este script implementa la funcionalidad de "Tree Capitator", que permite a los jugadores
 * talar árboles enteros al romper un solo bloque de tronco con un hacha.
 */

import { BlockPermutation, Dimension, ItemStack, system, Vector3, world, EntityInventoryComponent, ItemDurabilityComponent, Player, Block } from "@minecraft/server";

/**
 * @remarks
 * Define las direcciones relativas para buscar bloques adyacentes en un espacio 3D.
 * Esto se utiliza para encontrar los bloques vecinos durante el proceso de tala del árbol.
 */
const $DIRECTIONS: Vector3[] = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 },
    { x: 1, y: -1, z: 0 }, { x: -1, y: -1, z: 0 },
    { x: 0, y: -1, z: 1 }, { x: 0, y: -1, z: -1 }
];

/**
 * @remarks
 * El radio máximo de expansión horizontal desde el tronco original para buscar bloques.
 * Limita qué tan lejos se extenderá la tala para evitar afectar árboles cercanos.
 */
const $MAX_RADIUS_EXPAND = 8;

/**
 * @remarks
 * Un mapa que asocia tipos de hojas con sus correspondientes brotes.
 * Se utiliza para determinar qué tipo de brote plantar o soltar.
 */
const $LEAVES_TO_SAPLINGS = new Map<string, string>([
    ["minecraft:acacia_leaves", "minecraft:acacia_sapling"],
    ["minecraft:azalea_leaves", "minecraft:azalea"],
    ["minecraft:azalea_leaves_flowered", "minecraft:flowering_azalea"],
    ["minecraft:birch_leaves", "minecraft:birch_sapling"],
    ["minecraft:cherry_leaves", "minecraft:cherry_sapling"],
    ["minecraft:dark_oak_leaves", "minecraft:dark_oak_sapling"],
    ["minecraft:jungle_leaves", "minecraft:jungle_sapling"],
    ["minecraft:oak_leaves", "minecraft:oak_sapling"],
    ["minecraft:spruce_leaves", "minecraft:spruce_sapling"]
]);

/**
 * @remarks
 * Define probabilidades personalizadas para los objetos que sueltan las hojas al ser rotas.
 * Incluye probabilidades para soltar la propia hoja, un brote o un palo.
 */
const $CUSTOM_PROBABILITY = new Map<string, { toLeaves: number; toSapling: number; toStick: number }>([
    ["minecraft:acacia_leaves", { toLeaves: 0.2, toSapling: 0.1, toStick: 0.3 }],
    ["minecraft:azalea_leaves", { toLeaves: 0.25, toSapling: 0.1, toStick: 0.0 }],
    ["minecraft:azalea_leaves_flowered", { toLeaves: 0.25, toSapling: 0.1, toStick: 0.0 }],
    ["minecraft:birch_leaves", { toLeaves: 0.4, toSapling: 0.1, toStick: 0.3 }],
    ["minecraft:cherry_leaves", { toLeaves: 0.1, toSapling: 0.1, toStick: 0.1 }],
    ["minecraft:dark_oak_leaves", { toLeaves: 0.2, toSapling: 0.1, toStick: 0.1 }],
    ["minecraft:jungle_leaves", { toLeaves: 0.25, toSapling: 0.1, toStick: 0.1 }],
    ["minecraft:oak_leaves", { toLeaves: 0.2, toSapling: 0.1, toStick: 0.17 }],
    ["minecraft:spruce_leaves", { toLeaves: 0.25, toSapling: 0.1, toStick: 0.17 }]
]);

/**
 * @remarks
 * Un WeakMap para almacenar temporalmente el número de bloques rotos por cada jugador.
 * Se usa para calcular el daño final al hacha. La clave es el jugador y el valor es el conteo.
 */
const $BREAK_STORAGE = new WeakMap<Player, number>();

/**
 * @remarks
 * Convierte un objeto de coordenadas Vector3 en una clave de string única.
 * @param v - El vector de coordenadas {x, y, z}.
 * @returns Una cadena que representa las coordenadas.
 */
function coordsKey({ x, y, z }: Vector3): string {
    return `${x},${y},${z}`;
}

/**
 * @remarks
 * Procesa el botín de un bloque de hojas, aplicando probabilidades personalizadas.
 * Puede soltar el bloque de hojas, un brote o un palo.
 * @param dimension - La dimensión en la que se encuentra el bloque.
 * @param block - El bloque de hojas que se está procesando.
 * @param location - La ubicación del bloque de hojas.
 * @param player - El jugador que inició la tala.
 * @param origin - La ubicación original del tronco roto.
 */
function processLeafDrop(dimension: Dimension, block: Block, location: Vector3, player: Player, origin: Vector3) {
    const prob = $CUSTOM_PROBABILITY.get(block.typeId);
    if (!prob) return dimension.spawnItem(block.getItemStack(), location);

    const { toLeaves, toSapling, toStick } = prob;
    const saplingType = $LEAVES_TO_SAPLINGS.get(block.typeId);

    // Intenta replantar un brote en la ubicación original del árbol.
    if (saplingType) {
        dimension.setBlockPermutation(origin, BlockPermutation.resolve(saplingType));
    }
    // Probabilidad de soltar un brote
    if (saplingType && Math.random() < toSapling) {
        $BREAK_STORAGE.set(player, ($BREAK_STORAGE.get(player) ?? 0) + 1);
        return dimension.spawnItem(new ItemStack(saplingType, 1), location);
    }
    // Probabilidad de soltar un palo
    if (Math.random() < toStick) {
        $BREAK_STORAGE.set(player, ($BREAK_STORAGE.get(player) ?? 0) + 1);
        return dimension.spawnItem(new ItemStack("minecraft:stick", 1), location);
    }
    // Probabilidad de soltar el bloque de hojas
    if (Math.random() < toLeaves) {
        $BREAK_STORAGE.set(player, ($BREAK_STORAGE.get(player) ?? 0) + 1);
        return dimension.spawnItem(block.getItemStack(), location);
    }
}

/**
 * @remarks
 * Añade los vecinos de una ubicación a la cola de procesamiento si no han sido revisados.
 * @param queue - La cola de ubicaciones a procesar.
 * @param x - Coordenada X de la ubicación actual.
 * @param y - Coordenada Y de la ubicación actual.
 * @param z - Coordenada Z de la ubicación actual.
 * @param checked - Un Set con las claves de las ubicaciones ya revisadas.
 */
function enqueueNeighbors(queue: Vector3[], x: number, y: number, z: number, checked: Set<string>) {
    for (const dir of $DIRECTIONS) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        const nz = z + dir.z;
        const key = `${nx},${ny},${nz}`;
        if (!checked.has(key)) {
            queue.push({ x: nx, y: ny, z: nz });
        }
    }
}

world.beforeEvents.playerBreakBlock.subscribe(playerBreakBlock => {
    const { dimension, block, player } = playerBreakBlock;
    const itemStack = playerBreakBlock?.itemStack;

    // Sale si no se está usando un hacha o si el bloque no es un tronco.
    if (!itemStack?.typeId?.includes("axe")) return;
    if (!block.typeId.includes("log")) return;

    // Cancela el evento original de ruptura para manejarlo de forma personalizada.
    playerBreakBlock.cancel = true;
    const origin = block.location;
    const queue: Vector3[] = [block.above().location]; // Inicia la búsqueda desde el bloque de arriba.
    const checked = new Set<string>();
    const slot: number = player.selectedSlotIndex;
    $BREAK_STORAGE.set(player, 1); // Inicia el conteo de bloques rotos.

    /**
     * @remarks
     * Procesa la ruptura de bloques de forma secuencial y asíncrona.
     * Esto evita que el juego se congele al talar árboles grandes.
     */
    function* blockProcess() {
        // Suelta el item del bloque original y lo convierte en aire.
        dimension.spawnItem(block.getItemStack(), origin);
        block.setPermutation(BlockPermutation.resolve("minecraft:air"));

        while (queue.length > 0) {
            const loc = queue.shift()!;
            const { x, y, z } = loc;
            const locKey = coordsKey(loc);

            // Limita la expansión horizontal.
            if (Math.abs(x - origin.x) > $MAX_RADIUS_EXPAND || Math.abs(z - origin.z) > $MAX_RADIUS_EXPAND) continue;
            if (checked.has(locKey)) continue;

            checked.add(locKey);
            const currentBlock = dimension.getBlock(loc);
            if (!currentBlock) continue;

            const isLogOrLeaf = currentBlock.typeId.includes("log") || currentBlock.typeId.includes("leaves");
            if (!isLogOrLeaf) continue;

            // Procesa el bloque (hoja o tronco).
            if (currentBlock.typeId.includes("leaves")) {
                processLeafDrop(dimension, currentBlock, loc, player, origin);
            } else {
                $BREAK_STORAGE.set(player, ($BREAK_STORAGE.get(player) ?? 0) + 1);
                dimension.spawnItem(currentBlock.getItemStack(), loc);
            }

            // Rompe el bloque actual y añade sus vecinos a la cola.
            dimension.setBlockPermutation(loc, BlockPermutation.resolve("minecraft:air"));
            enqueueNeighbors(queue, x, y, z, checked);
            yield; // Pausa la ejecución para el siguiente tick.
        }
    }

    // Ejecuta el proceso de tala de forma asíncrona.
    system.runJob(blockProcess());

    // Una vez terminado el trabajo, calcula y aplica el daño al hacha.
    system.run(() => {
        const logs = $BREAK_STORAGE.get(player);
        if (!logs) return;

        const container = player.getComponent(EntityInventoryComponent.componentId).container;
        const durability = itemStack.getComponent(ItemDurabilityComponent.componentId);
        const damage = durability.damage;
        const new_damage = damage + logs;

        // Si el daño excede la durabilidad máxima, rompe el hacha.
        if (durability.maxDurability < new_damage) {
            container.setItem(slot, null);
            player.playSound("random.break", { volume: 0.8, pitch: 0.8 });
        } else {
            // Aplica el daño al hacha.
            durability.damage = new_damage;
            container.setItem(slot, itemStack);
        }
        
        // Limpia el almacenamiento para el jugador.
        $BREAK_STORAGE.delete(player);
    });
});

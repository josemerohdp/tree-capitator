# Tree Capitator

**Autor:** Six  
**Discord:** josemerohdp  
**Versión:** 1.0.0

Un script que permite talar árboles completos de manera instantánea al romper un solo bloque de tronco con un hacha.

## Características Principales

- **Tala Instantánea:** Derriba árboles enteros al romper un solo bloque de tronco con cualquier tipo de hacha.
- **Cálculo de Durabilidad:** El daño infligido al hacha es proporcional al número de bloques de madera y hojas destruidos.
- **Botín Personalizado:** Las hojas tienen una probabilidad configurada de soltar el propio bloque de hoja, un palo o un retoño.
- **Replantación Automática:** Intenta replantar un retoño del mismo tipo de árbol en el lugar donde se taló.
- **Optimizado para el Rendimiento:** Utiliza un sistema de trabajos (`runJob`) para procesar la tala de forma asíncrona, evitando que el juego se congele con árboles grandes.
- **Límites de Seguridad:** Incluye un radio máximo de expansión para evitar la destrucción accidental de estructuras o árboles cercanos.

## Desarrollo

Este proyecto está escrito en TypeScript y requiere Node.js y el compilador de TypeScript.

### Scripts

-   **Instalar dependencias:**
    ```bash
    npm install
    ```
-   **Compilar el código:**
    ```bash
    npm run build
    ```
    Este comando compila el archivo `source/six.ts` y genera el `scripts/six.js` que utiliza el juego.

-   **Compilar en modo observador:**
    ```bash
    npm run build:watch
    ```
    Este comando vigilará los cambios en los archivos `.ts` y los compilará automáticamente.

### Configuración

Puedes modificar algunas variables dentro de `source/six.ts` para ajustar el comportamiento del script:

-   `$MAX_RADIUS_EXPAND`: Radio máximo (en bloques) que el script buscará troncos y hojas horizontalmente desde el bloque original. Por defecto es `8`.
-   `$LEAVES_TO_SAPLINGS`: Mapa que asocia tipos de hojas con sus retoños correspondientes.
-   `$CUSTOM_PROBABILITY`: Mapa que define la probabilidad de que las hojas suelten objetos (hojas, retoños, palos).

## Licencia

Este proyecto se distribuye bajo la **Licencia Apache 2.0**.

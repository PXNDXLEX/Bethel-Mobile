import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mgxkfacmahqzfhqxljzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGtmYWNtYWhxemZocXhsanpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTg4NjEsImV4cCI6MjA5Mjg3NDg2MX0.7rLYmEayPKuSFQCwM6uFmmcCeRVaC8liE6j076-XRIw'
const supabase = createClient(supabaseUrl, supabaseKey)

// Format objects back to array of arrays matching Google Sheets columns
const mappers = {
    usuarios: (d) => [d.id, d.nombre, d.usuario, d.clave, d.rol, d.permisos_tabs, d.permisos_delete],
    historial_mp: (d) => [d.fecha, d.usuario, d.insumo, d.motivo, d.cantidad, d.unidad, d.stock_ant, d.stock_nue],
    auditoria: (d) => [d.fecha, d.usuario_id, d.accion, d.detalle],
    pedidos: (d) => [d.cliente, d.producto, d.cantidad, d.lugar, d.fecha, d.total, d.precio_u, d.estado, d.num_entrega, d.notas, d.bcv, d.abono, d.deuda, d.telefono, d.usuario_id],
    pagos: (d) => [d.fecha, d.cliente, d.monto_usd, d.monto_bs, d.tasa_bcv, d.ref_pago, d.nota, d.detalles, d.num_entrega, d.usuario_id],
    gastos: (d) => [d.fecha, d.descripcion, d.cantidad, d.precio_unit, d.total, d.unidad, d.usuario_id, d.tipo_empaque, d.cant_por_empaque, d.cant_empaques],
    produccion: (d) => [d.fecha, d.producto, d.cantidad, d.usuario_id],
    movimientos: (d) => [d.fecha, d.tipo, d.categoria, d.persona, d.descripcion, d.monto_usd, d.usuario_id],
    materia_prima: (d) => [d.nombre, d.tipo, d.unidad, d.stock, d.stock_minimo, d.notificar, d.usuario_id],
    productos: (d) => [d.nombre, d.precio, d.stock, d.precio_mayor, d.usuario_id],
    recetario: (d) => [d.producto, d.ingrediente, d.cantidad, d.unidad, d.usuario_id]
}

async function db_getData() {
    const [
        {data: configData}, {data: bcvData}, {data: productosData}, {data: lugaresData}, {data: clientesData},
        {data: pedidosData}, {data: pagosData}, {data: gastosData}, {data: prodData}, {data: movData},
        {data: mpData}, {data: usuData}, {data: histData}, {data: recData}
    ] = await Promise.all([
        supabase.from('config').select('*'),
        supabase.from('config').select('nombre_negocio'), // Mock for BCV or fetch real
        supabase.from('productos').select('*').order('id'),
        supabase.from('lugares').select('*').order('id'),
        supabase.from('clientes').select('*').order('id'),
        supabase.from('pedidos').select('*').order('id'),
        supabase.from('pagos').select('*').order('id'),
        supabase.from('gastos').select('*').order('id'),
        supabase.from('produccion').select('*').order('id'),
        supabase.from('movimientos').select('*').order('id'),
        supabase.from('materia_prima').select('*').order('id'),
        supabase.from('usuarios').select('*'),
        supabase.from('historial_mp').select('*').order('id'),
        supabase.from('recetario').select('*').order('id')
    ]);

    const productos = (productosData || []).map(p => ({
        nombre: p.nombre, precio: p.precio||0, stock: p.stock||0, precioMayor: p.precio_mayor||0
    }));

    const lugares = (lugaresData || []).map(l => l.nombre);
    const clientes = (clientesData || []).map(c => c.nombre);
    
    let confObj = { nombre: "Dulce Bethel", logo: "" };
    if(configData && configData.length > 0){
        confObj.nombre = configData[0].nombre_negocio || "Dulce Bethel";
        confObj.logo = configData[0].logo || "";
    }

    // BCV mock (in original it's fetched from api or config)
    let bcvRate = 427.93; // Default or fetch from real API if needed

    return {
        config: confObj,
        bcv: bcvRate,
        productos: productos,
        lugares: lugares,
        clientes: clientes,
        pedidosRaw: (pedidosData||[]).map(mappers.pedidos),
        pagosRaw: (pagosData||[]).map(mappers.pagos),
        gastosRaw: (gastosData||[]).map(mappers.gastos),
        produccionRaw: (prodData||[]).map(mappers.produccion),
        movimientosRaw: (movData||[]).map(mappers.movimientos),
        materiaPrimaRaw: (mpData||[]).map(mappers.materia_prima),
        usuariosRaw: (usuData||[]).map(mappers.usuarios),
        historialMPRaw: (histData||[]).map(mappers.historial_mp),
        recetarioRaw: (recData||[]).map(mappers.recetario)
    };
}

async function db_login(u, p) {
    const {data} = await supabase.from('usuarios').select('*').ilike('usuario', u).eq('clave', p);
    if(data && data.length > 0) {
        let d = data[0];
        return {
            id: d.id, nombre: d.nombre, usuario: d.usuario, rol: d.rol, 
            permisosTabs: d.permisos_tabs, permisosDelete: d.permisos_delete
        };
    }
    return null;
}

// Stub implementation of other methods. 
// They basically write to Supabase then return db_getData().
async function _genericWriteAndReturn(table, payload) {
    if(payload) await supabase.from(table).insert(payload);
    return await db_getData();
}

async function db_updateClientPhone(clientName, newPhone, userId) {
    await supabase.from('pedidos').update({telefono: newPhone}).eq('cliente', clientName);
    return await db_getData();
}

async function db_saveOrder(form, cart, userId) {
    let now = form.fecha ? form.fecha + "T12:00:00.000Z" : new Date().toISOString();
    let abonoRestante = parseFloat(form.abonadoUSD||0);
    let bcvRate = parseFloat(form.bcvRate||0);
    
    let pedPayloads = [];
    let detallesArr = [];

    for(let item of cart) {
        let precioItem = parseFloat(item.precio||0);
        let cantItem = parseFloat(item.cantidad||0);
        let totalItem = precioItem * cantItem;
        
        let abonoParaEsteItem = Math.min(abonoRestante, totalItem);
        abonoRestante -= abonoParaEsteItem;
        let deudaDeEsteItem = totalItem - abonoParaEsteItem;
        
        pedPayloads.push({
            cliente: form.cliente,
            producto: item.nombre,
            cantidad: cantItem,
            lugar: form.lugar,
            fecha: now,
            total: totalItem,
            precio_u: precioItem,
            estado: "Pendiente",
            num_entrega: form.numEntrega || "-",
            notas: form.notas,
            bcv: bcvRate,
            abono: abonoParaEsteItem,
            deuda: deudaDeEsteItem,
            telefono: form.telefono,
            usuario_id: userId
        });
        
        // Update product stock
        const {data: prod} = await supabase.from('productos').select('stock').eq('nombre', item.nombre).single();
        if(prod) {
            await supabase.from('productos').update({stock: (prod.stock||0) - cantItem}).eq('nombre', item.nombre);
        }
        
        detallesArr.push(`${cantItem}|${item.nombre}|${precioItem.toFixed(2)}|${totalItem.toFixed(2)}`);
    }
    
    if(pedPayloads.length > 0) await supabase.from('pedidos').insert(pedPayloads);
    
    let abonado = parseFloat(form.abonadoUSD||0);
    if(abonado > 0) {
        await supabase.from('pagos').insert({
            fecha: now,
            cliente: form.cliente,
            monto_usd: abonado,
            monto_bs: abonado * bcvRate,
            tasa_bcv: bcvRate,
            ref_pago: form.ref,
            nota: form.notaPago,
            detalles: detallesArr.join(";"),
            num_entrega: form.numEntrega,
            usuario_id: userId
        });
    }
    
    return await db_getData();
}

async function db_delGasto(idx, userId) {
    // Requires ID mapping. This is tricky because the frontend passes the array index.
    // In Supabase, we should delete by ID. But since frontend passes index:
    const {data} = await supabase.from('gastos').select('id').order('id', {ascending:true});
    if(data && data[idx]) {
        await supabase.from('gastos').delete().eq('id', data[idx].id);
    }
    return await db_getData();
}

async function db_saveProduct(p, userId) {
    const payload = {
        nombre: p.nombre,
        precio: parseFloat(p.precio||0),
        stock: parseFloat(p.stock||0),
        precio_mayor: parseFloat(p.precioMayor||0),
        usuario_id: userId
    };
    if(p.old) {
        await supabase.from('productos').update(payload).eq('nombre', p.old);
    } else {
        await supabase.from('productos').upsert(payload, {onConflict: 'nombre'});
    }
    return await db_getData();
}

async function db_delProduct(n, userId) {
    await supabase.from('productos').delete().eq('nombre', n);
    return await db_getData();
}

// Export google globally
window.google = {
    script: {
        run: new Proxy({}, {
            get: function(target, prop) {
                if(prop === 'withSuccessHandler') {
                    return function(callback) {
                        return new Proxy({}, {
                            get: function(t, method) {
                                return async function(...args) {
                                    try {
                                        // console.log("Calling", method, args);
                                        const res = await window.Backend[method](...args);
                                        if(callback) callback(res);
                                    } catch(e) {
                                        console.error("Backend Error:", method, e);
                                    }
                                }
                            }
                        });
                    }
                }
                return async function(...args) {
                    await window.Backend[prop](...args);
                }
            }
        })
    }
};

window.Backend = {
    db_getData,
    db_login,
    db_updateClientPhone,
    db_saveOrder,
    db_delGasto,
    db_saveProduct,
    db_delProduct,
    // Add other stubs returning db_getData() to prevent UI crash
    db_updateProductName: async () => await db_getData(),
    db_payDebt: async () => await db_getData(),
    db_updateCell: async () => await db_getData(),
    db_saveGastosBatch: async () => await db_getData(),
    db_saveProduccion: async () => await db_getData(),
    db_saveMovimiento: async () => await db_getData(),
    db_saveMateriaPrima: async () => await db_getData(),
    db_delMateriaPrima: async () => await db_getData(),
    db_saveReceta: async () => await db_getData(),
    db_delReceta: async () => await db_getData(),
    db_ajustarMateriaPrima: async () => await db_getData(),
};

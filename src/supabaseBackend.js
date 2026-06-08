import { createClient } from '@supabase/supabase-js'
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

window.NativeBiometric = NativeBiometric;

const supabaseUrl = 'https://mgxkfacmahqzfhqxljzn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGtmYWNtYWhxemZocXhsanpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTg4NjEsImV4cCI6MjA5Mjg3NDg2MX0.7rLYmEayPKuSFQCwM6uFmmcCeRVaC8liE6j076-XRIw'
const supabase = createClient(supabaseUrl, supabaseKey)

// Format objects back to array of arrays matching Google Sheets columns
const mappers = {
    usuarios: (d) => [d.id, d.nombre, d.usuario, d.clave, d.rol, d.permisos_tabs, d.permisos_delete],
    historial_mp: (d) => [d.fecha, d.usuario, d.insumo, d.motivo, d.cantidad, d.unidad, d.stock_ant, d.stock_nue],
    auditoria: (d) => [d.fecha, d.usuario_id, d.accion, d.detalle, d.id],
    pedidos: (d) => [d.cliente, d.producto, d.cantidad, d.lugar, d.fecha, d.total, d.precio_u, d.estado, d.num_entrega, d.notas, d.bcv, d.abono, d.deuda, d.telefono, d.usuario_id, d.id],
    pagos: (d) => [d.fecha, d.cliente, d.monto_usd, d.monto_bs, d.tasa_bcv, d.ref_pago, d.nota, d.detalles, d.num_entrega, d.usuario_id],
    gastos: (d) => [d.fecha, d.descripcion, d.cantidad, d.precio_unit, d.total, d.unidad, d.usuario_id, d.tipo_empaque, d.cant_por_empaque, d.cant_empaques],
    produccion: (d) => [d.fecha, d.producto, d.cantidad, d.usuario_id, d.id],
    movimientos: (d) => [d.fecha, d.tipo, d.categoria, d.persona, d.descripcion, d.monto_usd, d.usuario_id],
    materia_prima: (d) => [d.nombre, d.tipo, d.unidad, d.stock, d.stock_minimo, d.notificar, d.usuario_id],
    productos: (d) => [d.nombre, d.precio, d.stock, d.precio_mayor, d.usuario_id],
    recetario: (d) => [d.producto, d.ingrediente, d.cantidad, d.unidad, d.usuario_id]
}

async function db_getBCV() {
  try {
    let res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    if(res.ok) {
      let data = await res.json();
      if(data.promedio) return parseFloat(data.promedio);
    }
  } catch(e) {}
  try {
    let res2 = await fetch("https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv");
    if(res2.ok) {
      let data2 = await res2.json();
      if(data2.monitors && data2.monitors.usd && data2.monitors.usd.price) return parseFloat(data2.monitors.usd.price);
    }
  } catch(e) {}
  try {
    let {data} = await supabase.from('config').select('*');
    if(data && data.length > 0 && data[0].bcv_rate) return parseFloat(data[0].bcv_rate);
  } catch(e) {}
  return 0;
}

async function db_getData() {
    const b1 = await Promise.all([
        supabase.from('config').select('*'),
        db_getBCV(),
        supabase.from('productos').select('*').order('id'),
        supabase.from('lugares').select('*').order('id'),
        supabase.from('clientes').select('*').order('id')
    ]);
    const b2 = await Promise.all([
        supabase.from('pedidos').select('*').order('id'),
        supabase.from('pagos').select('*').order('id'),
        supabase.from('gastos').select('*').order('id'),
        supabase.from('produccion').select('*').order('id'),
        supabase.from('movimientos').select('*').order('id')
    ]);
    const b3 = await Promise.all([
        supabase.from('materia_prima').select('*').order('id'),
        supabase.from('usuarios').select('*'),
        supabase.from('historial_mp').select('*').order('id'),
        supabase.from('recetario').select('*').order('id'),
        supabase.from('auditoria').select('*').order('id', { ascending: false }).limit(200)
    ]);

    const configData = b1[0].data;
    const bcvRate = b1[1] || 1;
    const productosData = b1[2].data;
    const lugaresData = b1[3].data;
    const clientesData = b1[4].data;

    const pedidosData = b2[0].data;
    const pagosData = b2[1].data;
    const gastosData = b2[2].data;
    const prodData = b2[3].data;
    const movData = b2[4].data;

    const mpData = b3[0].data;
    const usuData = b3[1].data;
    const histData = b3[2].data;
    const recData = b3[3].data;
    const audData = b3[4].data;

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
        recetarioRaw: (recData||[]).map(mappers.recetario),
        auditoriaRaw: (audData||[]).map(mappers.auditoria)
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

async function db_updateUserPerfil(userId, nombre, newClave, oldClave) {
    const {data: user} = await supabase.from('usuarios').select('clave').eq('id', userId).single();
    if(!user || user.clave !== oldClave) {
        throw new Error("La contraseña actual es incorrecta");
    }
    
    let payload = { usuario: nombre };
    if(newClave) payload.clave = newClave;
    
    await supabase.from('usuarios').update(payload).eq('id', userId);
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

async function db_deletePedidosBulk(ids, userId) {
    const pedidosBorrados = [];
    for(const id of ids) {
        try {
            const {data: row} = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle();
            if(row) {
                pedidosBorrados.push(row);
                // Restaurar stock
                const {data: prod} = await supabase.from('productos').select('stock').eq('nombre', row.producto).maybeSingle();
                if(prod) {
                    await supabase.from('productos').update({stock: (parseFloat(prod.stock)||0) + parseFloat(row.cantidad||0)}).eq('nombre', row.producto);
                }
                // Borrar pagos asociados (mismo cliente, nota contiene el id)
                const {data: pagosAsoc} = await supabase.from('pagos').select('id, nota').eq('cliente', row.cliente);
                if (pagosAsoc) {
                    for (const pago of pagosAsoc) {
                        if (pago.nota && pago.nota.includes(String(id))) {
                            await supabase.from('pagos').delete().eq('id', pago.id);
                        }
                    }
                }
                // Borrar el pedido
                await supabase.from('pedidos').delete().eq('id', id);
            }
        } catch(e) {
            console.error('[BACKEND] Exception deleting id:', id, e);
            throw new Error('Fallo al borrar ID ' + id + ': ' + (e.message || e));
        }
    }
    // Registrar en auditoría
    if (pedidosBorrados.length > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 15);
        await supabase.from('auditoria').delete().lt('fecha', cutoff.toISOString());
        await supabase.from('auditoria').insert({
            fecha: new Date().toISOString(),
            usuario_id: userId || '',
            accion: 'BORRADO_PEDIDO',
            detalle: JSON.stringify({ pedidos: pedidosBorrados })
        });
    }
    return await db_getData();
}

async function db_revertAudit(auditId) {
    const { data: reg } = await supabase.from('auditoria').select('*').eq('id', auditId).maybeSingle();
    if (!reg) throw new Error('Registro de auditoría no encontrado');
    const detalle = JSON.parse(reg.detalle || '{}');
    if (reg.accion === 'BORRADO_PEDIDO' && Array.isArray(detalle.pedidos)) {
        for (const ped of detalle.pedidos) {
            const payload = {
                cliente: ped.cliente, producto: ped.producto, cantidad: ped.cantidad,
                lugar: ped.lugar, fecha: ped.fecha, total: ped.total, precio_u: ped.precio_u,
                estado: ped.estado, num_entrega: ped.num_entrega, notas: ped.notas,
                bcv: ped.bcv, abono: ped.abono, deuda: ped.deuda,
                telefono: ped.telefono, usuario_id: ped.usuario_id
            };
            await supabase.from('pedidos').insert(payload);
            // Restar stock del producto
            const { data: prod } = await supabase.from('productos').select('stock').eq('nombre', ped.producto).maybeSingle();
            if (prod) await supabase.from('productos').update({ stock: (parseFloat(prod.stock)||0) - (parseFloat(ped.cantidad)||0) }).eq('nombre', ped.producto);
        }
        await supabase.from('auditoria').delete().eq('id', auditId);
    }
    return await db_getData();
}

// col 8 => estado, col 10 => notas — actualiza TODOS los productos del grupo (cliente+fecha+lugar)
async function db_updateCell(id, col, value, cliente, fecha, lugar) {
    const colMap = { 8: 'estado', 10: 'notas' };
    const field = colMap[col];
    if (!field) return await db_getData();
    if (cliente && fecha && lugar) {
        // Actualizar todo el grupo
        let q = supabase.from('pedidos').update({ [field]: value })
            .eq('cliente', cliente)
            .eq('lugar', lugar)
            .gte('fecha', fecha + 'T00:00:00.000Z')
            .lte('fecha', fecha + 'T23:59:59.999Z');
        await q;
    } else {
        await supabase.from('pedidos').update({ [field]: value }).eq('id', id);
    }
    return await db_getData();
}

async function db_payDebt(indicesStr, montoUSD, ref, nota, bcvRate, numEntrega, userId) {
    const indices = String(indicesStr).split(',').map(Number).filter(n => !isNaN(n));
    
    // Fetch all pedidos ordered by id to match frontend array index
    const { data: todos } = await supabase.from('pedidos').select('*').order('id', { ascending: true });
    if (!todos) return await db_getData();
    
    let montoRestante = parseFloat(montoUSD) || 0;
    let clienteName = '';
    let detallesArr = [];
    
    for (const idx of indices) {
        const row = todos[idx];
        if (!row) continue;
        clienteName = row.cliente;
        const deudaActual = parseFloat(row.deuda) || 0;
        if (montoRestante > 0 && deudaActual > 0) {
            const aCobrar = Math.min(deudaActual, montoRestante);
            const nuevoAbono = (parseFloat(row.abono) || 0) + aCobrar;
            const nuevaDeuda = deudaActual - aCobrar;
            montoRestante -= aCobrar;
            await supabase.from('pedidos').update({ abono: nuevoAbono, deuda: nuevaDeuda }).eq('id', row.id);
            detallesArr.push(row.producto + ' x' + row.cantidad);
        }
    }
    
    const bcv = parseFloat(bcvRate) || 0;
    const finalNota = nota ? (nota + ' | Abono Pedidos: ' + indicesStr) : ('Abono Pedidos: ' + indicesStr);
    await supabase.from('pagos').insert({
        fecha: new Date().toISOString(),
        cliente: clienteName,
        monto_usd: parseFloat(montoUSD) || 0,
        monto_bs: (parseFloat(montoUSD) || 0) * bcv,
        tasa_bcv: bcv,
        ref_pago: ref || '',
        nota: finalNota,
        detalles: detallesArr.join(';'),
        num_entrega: numEntrega || '',
        usuario_id: userId || ''
    });
    
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

async function db_saveProduccion(data, userId) {
    const { fecha, items } = data;
    const isoFecha = fecha.includes('T') ? fecha : (fecha + 'T12:00:00.000Z');
    for (const item of items) {
        // Insertar registro de producción
        await supabase.from('produccion').insert({
            fecha: isoFecha,
            producto: item.producto,
            cantidad: parseFloat(item.cantidad) || 0,
            usuario_id: userId
        });
        // Sumar stock del producto
        const { data: prod } = await supabase.from('productos').select('stock').eq('nombre', item.producto).maybeSingle();
        if (prod) {
            await supabase.from('productos').update({ stock: (parseFloat(prod.stock)||0) + (parseFloat(item.cantidad)||0) }).eq('nombre', item.producto);
        }
        // Descontar materia prima según receta
        const { data: receta } = await supabase.from('recetario').select('*').eq('producto', item.producto);
        if (receta && receta.length > 0) {
            for (const ing of receta) {
                const { data: mp } = await supabase.from('materia_prima').select('stock, unidad').eq('nombre', ing.ingrediente).maybeSingle();
                if (mp) {
                    const cantDescontar = (parseFloat(ing.cantidad)||0) * (parseFloat(item.cantidad)||0);
                    const stockAnterior = parseFloat(mp.stock) || 0;
                    const stockNuevo = stockAnterior - cantDescontar;
                    await supabase.from('materia_prima').update({ stock: stockNuevo }).eq('nombre', ing.ingrediente);
                    await supabase.from('historial_mp').insert({
                        fecha: isoFecha,
                        usuario: userId,
                        insumo: ing.ingrediente,
                        motivo: 'Producción: ' + item.producto,
                        cantidad: cantDescontar,
                        unidad: mp.unidad || ing.unidad || '',
                        stock_ant: stockAnterior,
                        stock_nue: stockNuevo
                    });
                }
            }
        }
    }
    return await db_getData();
}

async function db_saveGastosBatch(gastosCart, userId) {
    for (const g of gastosCart) {
        const cantTotal = parseFloat(g.totalUnidades) || parseFloat(g.cantidad) || 0;
        const precioU = parseFloat(g.precioUnitario) || 0;
        const total = parseFloat(g.total) || (cantTotal * precioU);
        await supabase.from('gastos').insert({
            fecha: g.fecha || new Date().toISOString(),
            descripcion: g.desc || g.descripcion || '',
            cantidad: cantTotal,
            precio_unit: precioU,
            total: total,
            unidad: g.unidad || '',
            usuario_id: userId,
            tipo_empaque: g.tipoEmpaque || 'Unidad',
            cant_por_empaque: parseFloat(g.cantPorEmpaque) || 1,
            cant_empaques: parseFloat(g.cantEmpaques) || cantTotal
        });
        // Actualizar stock de materia prima si coincide por nombre
        const desc = (g.desc || g.descripcion || '').trim();
        if (desc) {
            const { data: mp } = await supabase.from('materia_prima').select('stock').ilike('nombre', desc).maybeSingle();
            if (mp) {
                await supabase.from('materia_prima').update({ stock: (parseFloat(mp.stock)||0) + cantTotal }).ilike('nombre', desc);
            }
        }
    }
    return await db_getData();
}

async function db_delProduccion(id, userId) {
    // 1. Get the record
    const { data: pRec } = await supabase.from('produccion').select('*').eq('id', id).maybeSingle();
    if (!pRec) return await db_getData();

    // 2. Subtract product stock
    const { data: prod } = await supabase.from('productos').select('stock').eq('nombre', pRec.producto).maybeSingle();
    if (prod) {
        await supabase.from('productos').update({ stock: (parseFloat(prod.stock)||0) - (parseFloat(pRec.cantidad)||0) }).eq('nombre', pRec.producto);
    }

    // 3. Revert MP stock (add back)
    const { data: recetaRows } = await supabase.from('recetario').select('*').eq('producto', pRec.producto);
    if (recetaRows && recetaRows.length > 0) {
        for (const ing of recetaRows) {
            const required = (parseFloat(ing.cantidad)||0) * (parseFloat(pRec.cantidad)||0);
            const { data: mp } = await supabase.from('materia_prima').select('stock').eq('nombre', ing.ingrediente).maybeSingle();
            if (mp) {
                const stockAnt = parseFloat(mp.stock)||0;
                const newStock = stockAnt + required;
                await supabase.from('materia_prima').update({ stock: newStock }).eq('nombre', ing.ingrediente);
                
                await supabase.from('historial_mp').insert({
                    fecha: new Date().toISOString(),
                    usuario: userId,
                    insumo: ing.ingrediente,
                    motivo: `Reversión de Producción eliminada: ${pRec.producto}`,
                    cantidad: required,
                    unidad: ing.unidad || '',
                    stock_ant: stockAnt,
                    stock_nue: newStock
                });
            }
        }
    }

    // 4. Delete the record
    await supabase.from('produccion').delete().eq('id', id);

    // 5. Add audit
    await supabase.from('auditoria').insert({
        fecha: new Date().toISOString(),
        usuario_id: userId,
        accion: 'BORRADO_PRODUCCION',
        detalle: `Producción eliminada: ${pRec.producto} (+${pRec.cantidad})`
    });

    return await db_getData();
}

async function db_saveMovimiento(m, userId) {
    await supabase.from('movimientos').insert({
        fecha: m.fecha ? (m.fecha + 'T12:00:00.000Z') : new Date().toISOString(),
        tipo: m.tipo || 'Egreso',
        categoria: m.categoria || 'Otro',
        persona: m.persona || '',
        descripcion: m.desc || m.descripcion || '',
        monto_usd: parseFloat(m.monto) || 0,
        usuario_id: userId
    });
    return await db_getData();
}

async function db_saveMateriaPrima(obj, userId) {
    const payload = {
        nombre: obj.nombre,
        tipo: obj.tipo || '',
        unidad: obj.unidad || '',
        stock: parseFloat(obj.stock) || 0,
        stock_minimo: parseFloat(obj.stockMinimo) || 0,
        notificar: obj.notificar === true || obj.notificar === 'true',
        usuario_id: userId
    };
    if (obj.old && obj.old !== obj.nombre) {
        await supabase.from('materia_prima').update(payload).eq('nombre', obj.old);
    } else {
        await supabase.from('materia_prima').upsert(payload, { onConflict: 'nombre' });
    }
    return await db_getData();
}

async function db_delMateriaPrima(nombre) {
    await supabase.from('materia_prima').delete().eq('nombre', nombre);
    return await db_getData();
}

async function db_ajustarMateriaPrima(obj, userId) {
    const { data: mp } = await supabase.from('materia_prima').select('stock, unidad').eq('nombre', obj.nombre).maybeSingle();
    if (!mp) throw new Error('Insumo no encontrado: ' + obj.nombre);
    const stockAnterior = parseFloat(mp.stock) || 0;
    const cantDescontar = parseFloat(obj.cantidad) || 0;
    const stockNuevo = stockAnterior - cantDescontar;
    await supabase.from('materia_prima').update({ stock: stockNuevo }).eq('nombre', obj.nombre);
    await supabase.from('historial_mp').insert({
        fecha: obj.fecha ? (obj.fecha + 'T12:00:00.000Z') : new Date().toISOString(),
        usuario: userId,
        insumo: obj.nombre,
        motivo: obj.motivo || 'Ajuste manual',
        cantidad: cantDescontar,
        unidad: mp.unidad || '',
        stock_ant: stockAnterior,
        stock_nue: stockNuevo
    });
    return await db_getData();
}

async function db_saveReceta(producto, recetaCart, userId) {
    // Borrar receta anterior
    await supabase.from('recetario').delete().eq('producto', producto);
    // Insertar nueva
    if (recetaCart && recetaCart.length > 0) {
        const rows = recetaCart.map(ing => ({
            producto: producto,
            ingrediente: ing.ingrediente || ing.nombre,
            cantidad: parseFloat(ing.cantidad) || 0,
            unidad: ing.unidad || '',
            usuario_id: userId
        }));
        await supabase.from('recetario').insert(rows);
    }
    return await db_getData();
}

async function db_delReceta(producto, userId) {
    await supabase.from('recetario').delete().eq('producto', producto);
    return await db_getData();
}

function createGoogleScriptRun() {
    function buildRunner(successCb, failureCb) {
        return new Proxy({}, {
            get: function(target, prop) {
                if (prop === 'withSuccessHandler') {
                    return function(cb) { return buildRunner(cb, failureCb); };
                }
                if (prop === 'withFailureHandler') {
                    return function(cb) { return buildRunner(successCb, cb); };
                }
                return async function(...args) {
                    try {
                        const res = await window.Backend[prop](...args);
                        if (successCb) successCb(res);
                    } catch(e) {
                        console.error("Backend Error:", prop, e);
                        if (failureCb) failureCb(e);
                        else throw e;
                    }
                }
            }
        });
    }
    return buildRunner(null, null);
}

// Export google globally
window.google = {
    script: {
        run: createGoogleScriptRun()
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
    // Add other methods to prevent UI crash and execute logic
    db_updateProductName: async () => await db_getData(),
    db_updateCell,
    db_payDebt,
    db_saveGastosBatch,
    db_saveProduccion,
    db_delProduccion,
    db_saveMovimiento,
    db_saveMateriaPrima,
    db_delMateriaPrima,
    db_saveReceta,
    db_delReceta,
    db_ajustarMateriaPrima,
    db_deletePedidosBulk,
    db_updateUserPerfil,
    db_revertAudit
};

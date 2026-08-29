const fs = require('fs');
const path = require('path');

const enPath = path.resolve(__dirname, 'src/messages/en.json');
const esPath = path.resolve(__dirname, 'src/messages/es.json');

// --- EN ---
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en["ProductReportsPage"] = {
  "title": "Product Reports",
  "totalProducts": "{count} Products",
  "generateReport": {
    "title": "Generate Product Report",
    "description": "Select a product and date range to generate a detailed sales report.",
    "productLabel": "Product",
    "allOption": "All Products",
    "selectPlaceholder": "Select a product",
    "searchPlaceholder": "Search product...",
    "empty": "No products found.",
    "startDateLabel": "Start Date",
    "endDateLabel": "End Date",
    "generateButton": "Generate Report"
  },
  "productList": {
    "title": "Product List",
    "description": "A quick view of your current products.",
    "nameHeader": "Name",
    "categoryHeader": "Category",
    "priceHeader": "Price",
    "empty": "No products found."
  },
  "report": {
    "reportTitle": "Product Sales Report",
    "noSalesFound": "No sales found for the selected filters.",
    "totalSold": "Total Sold",
    "filterLabels": {
      "product": "Product",
      "from": "From",
      "to": "To"
    },
    "tableHeaders": {
      "date": "Date",
      "invoice": "Invoice #",
      "quantity": "Quantity",
      "price": "Unit Price"
    }
  },
  "toasts": {
    "popupBlocked": {
      "title": "Popup Blocked",
      "description": "Please allow popups for this site to print the report."
    },
    "reportError": {
      "title": "Report Error",
      "description": "An unknown error occurred while generating the report."
    }
  }
};
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
console.log('✅ en.json updated');

// --- ES ---
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
es["ProductReportsPage"] = {
  "title": "Reportes de Productos",
  "totalProducts": "{count} Productos",
  "generateReport": {
    "title": "Generar Reporte de Producto",
    "description": "Selecciona un producto y un rango de fechas para generar un reporte detallado de ventas.",
    "productLabel": "Producto",
    "allOption": "Todos los Productos",
    "selectPlaceholder": "Selecciona un producto",
    "searchPlaceholder": "Buscar producto...",
    "empty": "No se encontraron productos.",
    "startDateLabel": "Fecha de Inicio",
    "endDateLabel": "Fecha de Fin",
    "generateButton": "Generar Reporte"
  },
  "productList": {
    "title": "Lista de Productos",
    "description": "Una vista rápida de tus productos actuales.",
    "nameHeader": "Nombre",
    "categoryHeader": "Categoría",
    "priceHeader": "Precio",
    "empty": "No se encontraron productos."
  },
  "report": {
    "reportTitle": "Reporte de Ventas de Productos",
    "noSalesFound": "No se encontraron ventas para los filtros seleccionados.",
    "totalSold": "Total Vendido",
    "filterLabels": {
      "product": "Producto",
      "from": "De",
      "to": "A"
    },
    "tableHeaders": {
      "date": "Fecha",
      "invoice": "Factura #",
      "quantity": "Cantidad",
      "price": "Precio Unitario"
    }
  },
  "toasts": {
    "popupBlocked": {
      "title": "Popup Bloqueado",
      "description": "Por favor permite los popups para este sitio para imprimir el reporte."
    },
    "reportError": {
      "title": "Error en el Reporte",
      "description": "Ocurrió un error desconocido al generar el reporte."
    }
  }
};
fs.writeFileSync(esPath, JSON.stringify(es, null, 2));
console.log('✅ es.json updated');
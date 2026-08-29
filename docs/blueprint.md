# **App Name**: BizCore

## Core Features:

- Admin Panel: Provides a centralized interface for managing all aspects of the business, including a main menu, search bar, breadcrumb navigation, primary actions, profile management, help button, settings, and branding.
- Catalog Management: Enables the creation and management of catalogs for vendors, raw materials, phases, customers, and accounts, including relevant details for each category, leveraging Firestore for data storage.
- Product Definition: Allows defining products based on raw materials, including amounts, percentages, phases, costs, sale price, and packaging information. Stores product definitions in the database.
- Expense and Income Tracking: Captures expense and income records with date, concept, and other relevant details. Stored securely using a database.
- Production Recording: Tracks production records including product type, phase, date, time, and number of pieces produced. Manages raw material consumption and updates inventory levels. Connects directly with Firestore for seamless updates.
- Packing and Inventory: Records packing information, including product type, date, time, and number of pieces packed. Updates the inventory with the packed items, with all inventory items securely managed using a database.
- Invoice Generation: Creates proforma and standard invoices, capturing product details, discounts, quantities, customer information, and grand totals. Decrements the appropriate number of items sold in final invoice form from the overall inventory totals in Firestore.
- Reporting and Analytics: Generates detailed reports on vendors, customers, production products, raw materials, inventory, and sales. Provides insights through a dashboard displaying key metrics with filtering options. The LLM will be a tool which incorporates the current date/time in a corner logo.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) for a professional and trustworthy feel.
- Background color: Light gray (#ECEFF1) to provide a clean and neutral backdrop.
- Accent color: Orange (#FF9800) to highlight key actions and call-to-action elements.
- Headline font: 'Space Grotesk' sans-serif font for a tech-centric, professional feel for titles; body text: 'Inter' sans-serif font for a neutral, easily-readable feel for body text.
- Use clean, professional icons from a consistent set to represent different functions and data types.
- Maintain a clean, organized layout with a clear visual hierarchy. Utilize the sidebar for main navigation and top bar for search and user-related actions.
- Employ subtle animations for transitions and feedback to enhance user experience without being distracting.
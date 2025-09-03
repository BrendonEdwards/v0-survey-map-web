# Survey Map Web App

A sleek, responsive survey map application built with Next.js and Leaflet for visualizing survey grid centroids with search functionality and sharing capabilities.

## Features

- **Interactive Map**: Full-screen Leaflet map with zoom-based point visibility
- **KML Data Loading**: Automatically loads and parses survey grid centroids from KML files
- **Smart Search**: Real-time search with autocomplete suggestions for cell IDs
- **Responsive Design**: Apple-like interface optimized for desktop and mobile
- **URL Sharing**: Share specific map views and cell locations via URL
- **Dual Basemaps**: Switch between OpenStreetMap Standard and Humanitarian layers
- **Performance Optimized**: Canvas rendering for smooth interaction with 20,000+ points

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone or download the project
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Place your KML file in the `public` folder as `grid_centroid_lod_single.kml`

4. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## KML File Setup

### Placing Your KML File

1. **Location**: Place your KML file in the `public` folder
2. **Filename**: Must be named `grid_centroid_lod_single.kml`
3. **Format**: Standard KML format with Placemark elements

### KML Structure Requirements

Your KML file should follow this structure:

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Survey Grid Centroids</name>
    <Placemark>
      <name>A23</name>
      <description>Survey cell A23</description>
      <Point>
        <coordinates>-74.006,40.7128,0</coordinates>
      </Point>
    </Placemark>
     More placemarks... 
  </Document>
</kml>
\`\`\`

**Important Notes:**
- The `<name>` element becomes the searchable cell ID
- Coordinates format: `longitude,latitude,altitude`
- The app automatically maps KML `Name` fields to `cell_id` properties

### Replacing the KML File

To use your own survey data:

1. Replace `public/grid_centroid_lod_single.kml` with your KML file
2. Ensure your KML follows the required structure above
3. Restart the development server
4. The app will automatically load your new data

## Usage

### Basic Navigation

- **Zoom In**: Use mouse wheel or zoom controls to zoom in past level 15 to see survey points
- **Search**: Type a cell ID (e.g., "A23") in the search box and press Enter or click "Go"
- **Basemap**: Switch between Standard and Humanitarian map layers using the control panel
- **Share**: Click the share button to copy the current view URL to clipboard

### URL Sharing

The app supports two types of URL sharing:

1. **Map Position**: `#zoom/latitude/longitude`
   - Example: `#15/40.71280/-74.00600`

2. **Cell ID Focus**: `?id=cellId`
   - Example: `?id=A23`

3. **Combined**: `?id=A23#16/40.71280/-74.00600`

### Mobile Features

- **Responsive Header**: Collapsible menu on mobile devices
- **Touch-Friendly**: Optimized touch targets and gestures
- **Native Sharing**: Uses device native sharing when available

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Connect your repository to [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and deploy your app
4. Your KML file in the `public` folder will be included in the deployment

### Deploy to Other Platforms

The app is a standard Next.js application and can be deployed to any platform that supports Node.js:

- **Netlify**: Use the Next.js build command
- **AWS Amplify**: Connect your Git repository
- **Railway**: Deploy directly from GitHub
- **DigitalOcean App Platform**: Use the Next.js preset

### Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Technical Details

### Performance Optimizations

- **Canvas Rendering**: Uses Leaflet's canvas renderer for smooth performance with large datasets
- **Zoom-Based Loading**: Points only render at zoom level 15+ to maintain performance
- **Dynamic Imports**: Map components are loaded dynamically to reduce initial bundle size
- **Efficient KML Parsing**: Native DOM parser for fast KML processing

### Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Features**: Requires JavaScript enabled, supports touch and mouse interaction

### Customization

The app uses Tailwind CSS with a custom design system. Key customization points:

- **Colors**: Modify `app/globals.css` design tokens
- **Fonts**: Update font imports in `app/layout.tsx`
- **Map Styling**: Adjust point colors and sizes in `components/map-container.tsx`
- **UI Components**: Customize components in the `components/` directory

## Troubleshooting

### Common Issues

1. **KML Not Loading**
   - Ensure file is named exactly `grid_centroid_lod_single.kml`
   - Check file is in the `public` folder
   - Verify KML format matches requirements

2. **Points Not Visible**
   - Zoom in to level 15 or higher
   - Check browser console for loading errors

3. **Search Not Working**
   - Ensure KML has loaded successfully
   - Verify cell IDs match the `<name>` elements in your KML

4. **Mobile Issues**
   - Clear browser cache
   - Ensure JavaScript is enabled
   - Try refreshing the page

### Support

For technical issues or questions about deployment, please check:
- Browser developer console for error messages
- Network tab to verify KML file loading
- Ensure all dependencies are properly installed

## License

This project is open source and available under the MIT License.

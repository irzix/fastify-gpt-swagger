export const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <style>
        .swagger-ui .topbar {
            display: none;
        }
        .search-container {
            padding: 20px;
            background: #f8f8f8;
            border-bottom: 1px solid #ddd;
        }
        .search-container input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .pagination {
            padding: 20px;
            text-align: center;
            background: #f8f8f8;
            border-top: 1px solid #ddd;
        }
        .pagination button {
            padding: 8px 16px;
            margin: 0 5px;
            background: #4990e2;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .pagination button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="search-container">
        <input type="text" id="search" placeholder="Search endpoints..." onkeyup="filterEndpoints(this.value)">
    </div>
    <div id="swagger-ui"></div>
    <div class="pagination">
        <button onclick="prevPage()">Previous</button>
        <span id="pageInfo"></span>
        <button onclick="nextPage()">Next</button>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script>
        let currentPage = 1;
        const itemsPerPage = 20;
        let allEndpoints = [];
        let filteredEndpoints = [];

        async function loadEndpoints() {
            try {
                const response = await fetch('/swagger-gpt-docs/json');
                const swaggerData = await response.json();
                
                // Convert Swagger data to endpoints list
                allEndpoints = Object.entries(swaggerData.paths).flatMap(([path, methods]) => 
                    Object.entries(methods).map(([method, details]) => ({
                        path,
                        method,
                        details
                    }))
                );
                
                filteredEndpoints = [...allEndpoints];
                displayEndpoints();
            } catch (error) {
                console.error('Error loading endpoints:', error);
            }
        }

        function filterEndpoints(searchTerm) {
            filteredEndpoints = allEndpoints.filter(endpoint => 
                endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                endpoint.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (endpoint.details.summary || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
            currentPage = 1;
            displayEndpoints();
        }

        function prevPage() {
            if (currentPage > 1) {
                currentPage--;
                displayEndpoints();
            }
        }

        function nextPage() {
            if (currentPage < Math.ceil(filteredEndpoints.length / itemsPerPage)) {
                currentPage++;
                displayEndpoints();
            }
        }

        function displayEndpoints() {
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const currentEndpoints = filteredEndpoints.slice(start, end);
            
            // Update pagination info
            document.getElementById('pageInfo').textContent = 
                \`Page \${currentPage} of \${Math.ceil(filteredEndpoints.length / itemsPerPage)}\`;
            
            // Update Swagger UI with current endpoints
            const swaggerData = {
                openapi: '3.0.0',
                info: {
                    title: 'API Documentation',
                    version: '1.0.0'
                },
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                            description: 'Authorization token'
                        }
                    }
                },
                paths: currentEndpoints.reduce((acc, endpoint) => {
                    if (!acc[endpoint.path]) {
                        acc[endpoint.path] = {};
                    }
                    acc[endpoint.path][endpoint.method] = endpoint.details;
                    return acc;
                }, {})
            };

            ui.specActions.updateSpec(JSON.stringify(swaggerData));
        }

        const ui = SwaggerUIBundle({
            url: '/swagger-gpt-docs/json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl,
                SwaggerUIBundle.plugins.Topbar,
                SwaggerUIBundle.plugins.Filter
            ],
            layout: "BaseLayout",
            displayOperationId: true,
            displayRequestDuration: true,
            docExpansion: "list",
            showExtensions: true,
            showCommonExtensions: true,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
            tryItOutEnabled: true,
            requestSnippetsEnabled: true,
            requestSnippets: {
                generators: {
                    curl_bash: {
                        title: 'cURL (bash)',
                        syntax: 'bash'
                    }
                },
                defaultExpanded: true,
                languages: ['curl_bash']
            }
        });

        window.onload = loadEndpoints;
    </script>
</body>
</html>`;
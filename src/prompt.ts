export const generatePrompt = (handlerCode: string) => {
    return `
This is a Fastify route handler function. Please generate a JSON Schema for the request (query, body, params) and response output based on it.

Important: Please return only a JSON object, without any additional text. The JSON format must be exactly like this:

{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    }
  },
  "parameters": [
    {
      "name": "paramName",
      "in": "path",
      "schema": {
        "type": "string",
        "description": "Parameter description"
      },
      "required": true
    }
  ],
  "responses": {
    "200": {
      "description": "Successful response",
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          }
        }
      }
    }
  }
}

Important notes:
1. Return only JSON, without any additional text
2. Use 'id' instead of '$id'
3. Use 'type' instead of 'format'
4. Use 'additionalProperties: false'
5. Use correct commas
6. Use double quotes for keys
7. For parameter detection:
   - Look for variables in URL path (like :id or {id})
   - Look for variables in query parameters
   - Look for variables in request body
   - Look for variables used in the code
8. For each parameter:
   - Extract the exact parameter name from the code
   - Determine the appropriate data type
   - Write appropriate descriptions based on code usage
9. For responses:
   - Look for return or reply in the code
   - Analyze the returned data structure
   - Specify required and optional fields
10. For authentication detection:
    - Look for request.headers.authorization checks
    - Look for guard or similar usage
    - Look for status checks in authentication results
    - If authentication is required, add the security field:
      "security": [
        {
          "bearerAuth": []
        }
      ]
    - If 401 or 403 errors are returned, add them to responses
    - Look for "Unauthorized" or "Forbidden" error messages
    - All response descriptions must be in English

Route handler code:
${handlerCode}
`
}
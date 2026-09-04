# AnnoQ Services

<div class="docs-callout">
  <a class="docs-callout-media" href="https://api-v2.annoq.org/docs" target="_blank" rel="noopener noreferrer"><img class="docs-callout-logo" src="/assets/images/swagger.svg" alt="Swagger" /></a>
  <div class="docs-callout-body">
    <p class="docs-callout-title">AnnoQ REST API</p>
    <p class="docs-callout-text">Browse every end point, inspect the request and response schemas, and run live queries from the interactive Swagger documentation.</p>
    <a class="docs-callout-action" href="https://api-v2.annoq.org/docs" target="_blank" rel="noopener noreferrer">Open the API documentation</a>
  </div>
</div>

In addition to viewing and downloading SNP annotations from the [AnnoQ Website](https://annoq.org), users can use AnnoQ Services to retrieve information programatically.  The [API](https://api-v2.annoq.org/docs) with Swagger documentation can be used from the command line for impromptu access or as part of scripts within large workflows. 

To facilitate easy integration, two libraries that encapsulate the AnnoQ API have been developed:
1.  [R package (AnnoQR)](https://github.com/USCbiostats/AnnoQR)
2.  [python package (annoq-py)](https://github.com/USCbiostats/annoq-py)  

Utilizing the libraries allows for abstraction, realiability, performance optimization and portability. They expose essential features of the system and allow developers freedom from having to focus on the internal workings of the system.  View the tutorials for the [R package](/docs/tutorials/r-package) and [python package](/docs/tutorials/annoq-py) for more details.

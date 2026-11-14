/** Portal's real answers (handlers run on a sample visit, 14/11), the measure as Portal stores it. */
export const VISIT_WITH_ID = {
 "id": "65f0000000000000000000a1",
 "type": "VIS",
 "code": "VIS-2026-0003",
 "title": "Visita técnica VIS-2026-0003",
 "status": "draft",
 "stage": "draft",
 "stageLabel": "Borrador",
 "datos": {
  "prospecto": "Condominio Los Álamos",
  "lugar": "Av. Los Incas 120, Surco",
  "lat": -12.1,
  "lng": -77,
  "precisionM": 8,
  "fecha": "2026-11-13T20:00:00.000Z",
  "ingeniero": "Rosa Campos"
 },
 "cifras": {
  "puntos": 1,
  "fotos": 0,
  "preguntas": 2,
  "respondidas": 1
 },
 "forms": {
  "datos": {
   "type": "object",
   "properties": {
    "prospecto": {
     "type": "string",
     "title": "Prospecto o cliente",
     "maxLength": 200
    },
    "contacto": {
     "type": "string",
     "title": "Contacto",
     "maxLength": 120
    },
    "telefono": {
     "type": "string",
     "title": "Teléfono",
     "maxLength": 30
    }
   },
   "required": [
    "prospecto"
   ]
  },
  "entrevista": {
   "type": "object",
   "properties": {
    "r01": {
     "type": "string",
     "title": "Pregunta q1",
     "oneOf": [
      {
       "const": "si",
       "title": "Sí"
      },
      {
       "const": "no",
       "title": "No"
      }
     ]
    },
    "r02": {
     "type": "string",
     "title": "Pregunta q2",
     "oneOf": [
      {
       "const": "Arcilla",
       "title": "Arcilla"
      },
      {
       "const": "Arena",
       "title": "Arena"
      }
     ]
    }
   },
   "required": []
  },
  "conclusion": {
   "type": "object",
   "properties": {
    "conclusion": {
     "type": "string",
     "title": "Conclusión",
     "maxLength": 2000
    }
   },
   "required": []
  }
 },
 "sections": [
  {
   "id": "datos",
   "title": "Datos",
   "required": true,
   "state": "done",
   "summary": [
    "Condominio Los Álamos",
    "Av. Los Incas 120, Surco"
   ],
   "results": [],
   "form": "datos",
   "values": {
    "prospecto": "Condominio Los Álamos"
   }
  },
  {
   "id": "puntos",
   "title": "Puntos del mapa",
   "required": true,
   "state": "done",
   "summary": [
    "1 punto"
   ],
   "results": [],
   "tool": "marcar_punto_de_visita",
   "items": [
    {
     "id": "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
     "n": 1,
     "tipo": "GIBA",
     "tipoLabel": "Giba o rompemuelle",
     "note": "Giba de 4 m",
     "measure": {
      "value": 4,
      "unit": "m"
     },
     "lat": -12.05,
     "lng": -77.04,
     "at": "2026-11-13T20:00:00.000Z",
     "media": []
    }
   ]
  },
  {
   "id": "fotos",
   "title": "Fotos",
   "required": false,
   "state": "empty",
   "summary": [
    "0 fotos"
   ],
   "results": [],
   "tool": "subir_foto_de_visita",
   "items": []
  },
  {
   "id": "entrevista",
   "title": "Entrevista",
   "required": false,
   "state": "partial",
   "summary": [
    "1 de 2 preguntas"
   ],
   "results": [],
   "form": "entrevista",
   "values": {
    "r01": "no"
   }
  },
  {
   "id": "conclusion",
   "title": "Conclusión",
   "required": false,
   "state": "empty",
   "summary": [],
   "results": [],
   "form": "conclusion",
   "values": {}
  }
 ],
 "map": {
  "streets": [],
  "points": [
   {
    "pointId": "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f",
    "n": 1,
    "tipo": "GIBA",
    "lat": -12.05,
    "lng": -77.04
   }
  ],
  "marks": []
 },
 "publish": {
  "label": "Terminar visita",
  "missing": []
 }
} as const;
export const NEW_VISIT = {
 "document": {
  "id": null,
  "type": "VIS",
  "code": "",
  "title": "Nueva visita técnica",
  "status": "draft",
  "stage": "draft",
  "stageLabel": "Borrador",
  "forms": {
   "datos": {
    "type": "object",
    "properties": {
     "prospecto": {
      "type": "string",
      "title": "Prospecto o cliente",
      "maxLength": 200
     },
     "contacto": {
      "type": "string",
      "title": "Contacto",
      "maxLength": 120
     },
     "telefono": {
      "type": "string",
      "title": "Teléfono",
      "maxLength": 30
     }
    },
    "required": [
     "prospecto"
    ]
   }
  },
  "sections": [
   {
    "id": "datos",
    "title": "Datos",
    "required": true,
    "state": "empty",
    "summary": [],
    "results": [],
    "form": "datos",
    "values": {}
   }
  ],
  "publish": {
   "label": "Crear visita",
   "missing": [
    "Escribe a quién visitas"
   ]
  }
 },
 "visitas": [
  {
   "id": "65f0000000000000000000a1",
   "code": "VIS-2026-0003",
   "prospect": "Condominio Los Álamos",
   "place": "Av. Los Incas 120, Surco",
   "visitedAt": "2026-11-13T20:00:00.000Z",
   "engineer": "Rosa Campos",
   "stage": "draft",
   "stageLabel": "Borrador",
   "points": 2
  }
 ]
} as const;

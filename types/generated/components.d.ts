import type { Schema, Struct } from '@strapi/strapi';

export interface TratamentDinteTratamentDinte extends Struct.ComponentSchema {
  collectionName: 'components_tratament_dinte_tratament_dintes';
  info: {
    displayName: 'Tratament_dinte';
  };
  attributes: {
    numar_dinte: Schema.Attribute.Enumeration<
      [
        'dinte_1.8',
        'dinte_1.7',
        'dinte_1.6',
        'dinte_1.5',
        'dinte_1.4',
        'dinte_1.3',
        'dinte_1.2',
        'dinte_1.1',
        'dinte_2.1',
        'dinte_2.2',
        'dinte_2.3',
        'dinte_2.4',
        'dinte_2.5',
        'dinte_2.6',
        'dinte_2.7',
        'dinte_2.8',
        'dinte_4.8',
        'dinte_4.7',
        'dinte_4.6',
        'dinte_4.5',
        'dinte_4.4',
        'dinte_4.3',
        'dinte_4.2',
        'dinte_4.1',
        'dinte_3.1',
        'dinte_3.2',
        'dinte_3.3',
        'dinte_3.4',
        'dinte_3.5',
        'dinte_3.6',
        'dinte_3.7',
        'dinte_3.8',
      ]
    >;
    observatii: Schema.Attribute.String;
    pret: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    status_tratament: Schema.Attribute.Enumeration<
      ['Planificat', 'In_progres', 'Finalizat']
    >;
    tip_procedura: Schema.Attribute.Enumeration<
      [
        'AditieOs',
        'Canal',
        'CoronitaAlbastra',
        'CoronitaGalbena',
        'CoronitaRoz',
        'Extractie',
        'Implant',
        'Punte',
      ]
    > &
      Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'tratament-dinte.tratament-dinte': TratamentDinteTratamentDinte;
    }
  }
}

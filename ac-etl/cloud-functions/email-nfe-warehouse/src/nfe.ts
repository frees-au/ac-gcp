import assert from 'assert';
import { XMLParser } from 'fast-xml-parser';
import { InvoiceRecordLine } from './bigquery';

/**
 * NFe Data helper class.
 *
 * This does not do any XSD validation, it just converts XML to
 * JSON and providers helper methods.
 */
class NfeDocument {
  private nfeJson: any;

  constructor(xmlString: string, debugContext: string) {
    try {
      const options = {
        ignoreAttributes: false,
        attributeNamePrefix : "_"
      };
      const parser = new XMLParser(options);
      this.nfeJson = parser.parse(xmlString);
    }
    catch {
      console.log(`XML parsing error for ${debugContext}`);
    }
  }

  isNfeValid(): boolean {
    return ['invoice', 'service', 'event'].includes(this.getType());
  }

  /**
   * My attempt to classify documents.
   */
  getType(): string {
    try {
      if (this.nfeJson.nfeProc !== undefined) {
        return 'invoice';
      }
      else if (this.nfeJson.procEventoNFe !== undefined) {
        return 'event';
      }
      else if (this.nfeJson.CompNfse !== undefined) {
        return 'service';
      }
    }
    catch(error) {
      console.log(['Error getting type', Object.keys(this.nfeJson)]);
    }
    return 'unknown';
  }

  lineItems(): InvoiceRecordLine[] {
    let foundItems: any = {};
    let lineItems: InvoiceRecordLine[] = [];
    if (this.getType() == 'invoice') {
      foundItems = this.nfeJson?.nfeProc?.NFe?.infNFe?.det;
      if (foundItems == null || typeof foundItems[Symbol.iterator] !== 'function') {
        // Single items are sometimes not in an array.
        foundItems = [foundItems];
      }
      for (const item of foundItems) {
        if (item?._nItem != undefined) {
          lineItems.push({
            nfeId: this.getDocumentId(),
            lineNumber: item?._nItem,
            itemCode: item?.prod?.cProd || 'nqr',
            itemDesc: item?.prod?.xProd,
            cfop: item?.prod?.CFOP,
            unitCode: item?.prod?.uCom || 'nqr',
            unitQty: item?.prod?.qCom || 0,
            unitPrice: Math.ceil(item.prod.vUnCom * 10000) / 10000,
            lineTotal: Math.ceil(item?.prod?.vProd * 10000) / 10000,
            batchSequence: 0,
          });
        }
      }
      assert(typeof foundItems == 'object');
    }
    else if (this.getType() == 'service') {
      // Service XML does not have line items so derive from other values.
      lineItems.push({
        nfeId: this.getDocumentId(),
        lineNumber: 0,
        itemCode: '',
        itemDesc: 'yyy',
        cfop: '',
        unitCode: '',
        unitQty: 0,
        unitPrice: 0,
        lineTotal: 0,
        batchSequence: 0,
      });
    }
    return lineItems;
  }

  /**
   * A long invoice description based on the invoice lines.
   */
  getInvoiceDescription(): string {
    let descriptions = [];
    const lineItems = this.lineItems();
    descriptions.push(`Description of ${Object.keys(lineItems).length} line items:`);
    for (let i in lineItems) {
      descriptions.push(`${lineItems[i].itemDesc}`);
    }
    return descriptions.map(this.cleanDescriptiveTextForStorage).join('; ');
  }

  /**
   * Part of the XML that represents the supplier.
   */
  supplier(): any {
    let supplier: any = {};
    switch (this.getType()) {
      case 'invoice':
        supplier = this.nfeJson?.nfeProc?.NFe?.infNFe?.emit || {};
        break;
      case 'service':
        supplier = this.nfeJson?.CompNfse?.Nfse?.InfNfse?.PrestadorServico || {};
        break;
    }
    return supplier;
  }

  /**
   * A semblance on an ID.
   */
  getSupplierId(): string {
    const supplier = this.supplier();
    if (this.getType() === 'invoice') {
      if (supplier.CNPJ !== undefined) {
        return `CNPJ-${supplier.CNPJ}`;
      }
      else {
        return `CPF-${supplier.CPF}`;
      }
    }
    else if (this.getType() === 'service') {
      if (supplier.IdentificacaoPrestador.Cnpj !== undefined) {
        return `CNPJ-${supplier.IdentificacaoPrestador.Cnpj}`;
      }
    }
    return '';
  }

  /**
   * Get the supplier name.
   */
  getSupplierDisplayName(): string {
    const supplier = this.supplier();
    return supplier?.xFant || supplier?.xNome || supplier?.RazaoSocial;
  }

  /**
   * The date of the doc.
   */
  getDateTime(): string {
    let dateStr = '';
    try {
      switch (this.getType()) {
        case 'invoice':
          dateStr = this.nfeJson?.nfeProc?.NFe?.infNFe?.ide?.dhEmi;
          break;
        case 'service':
          dateStr = this.nfeJson?.CompNfse?.Nfse?.InfNfse?.DataEmissao;
          break;
      }
    } catch (err) {}
    let date = new Date(dateStr);
    dateStr = date.toISOString().slice(0, 19).replace("T", " ");
    return dateStr;
  }

  /**
   * The invoice number or ID.
   */
  getInvoiceNumber(): string {
    switch (this.getType()) {
      case 'invoice':
        return this.nfeJson?.nfeProc?.NFe?.infNFe?.ide?.nNF;
      case 'service':
        return this.nfeJson?.CompNfse?.Nfse?.InfNfse?.Numero;
    }
    return '';
  }

  /**
   * The invoice total.
   */
  getInvoiceTotal(): number {
    let value: any = '0';
    switch (this.getType()) {
      case 'invoice':
        value = this.nfeJson?.nfeProc?.NFe?.infNFe?.total?.ICMSTot?.vNF;
        break;
      case 'service':
        value = this.nfeJson?.CompNfse?.Nfse?.InfNfse?.Servico?.Valores?.ValorLiquidoNfse;
        break;
    }
    return Number(value);
  }

  /**
   * A document ID usually like NFe...
   */
  getDocumentId(): string {
    let id = '';
    try {
      switch (this.getType()) {
        case 'invoice':
          id = this.nfeJson?.nfeProc?.NFe?.infNFe?._Id;
          break;
        case 'service':
          id = `Nfse${this.nfeJson?.CompNfse?.Nfse?.InfNfse?.Numero}`;
          break;
      }
    } catch (err) {}
    if (typeof id === 'string') {
      return id;
    }
    return '';
  }

  /**
   * An appropriate file name.
   */
  getFileNameXml(): string {
    return `${this.getDocumentId()}.xml`;
  }

  /**
   * Designed to me a good ML description.
   */
  cleanDescriptiveTextForStorage(text: string): string {
    text = text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ');
    text = text.replace(/"/g, "'");
    text = text.replace(/;/g, ',');
    text = text.replace(/\s+/g, ' ');
    return text;
  }

}

export default NfeDocument;

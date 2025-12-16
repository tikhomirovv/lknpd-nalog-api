import NalogClient from "./NalogClient";
import { INalogAddIncomeResponse, INalogApiInitParams, INalogCancelIncomeResponse, INalogProfile, INalogReceiptIncome, IServiceIncome } from "./types";
import getTotalAmount from "./utils/getTotalAmount";
import fetch from "cross-fetch";

class NalogApi extends NalogClient {
  constructor({ inn, password, phone }: INalogApiInitParams) {
    super({ inn, password, phone });
  }

  async getUserInfo(): Promise<INalogProfile> {
    return await this.callMethod("user");
  }

  async addIncome(services: IServiceIncome[] | IServiceIncome, date = new Date()): Promise<string> {
    services = Array.isArray(services) ? services : [services];
    const totalAmount = getTotalAmount(services);
    const { approvedReceiptUuid, message }: INalogAddIncomeResponse = await this.callMethod("income", {
      paymentType: "CASH",
      ignoreMaxTotalIncomeRestriction: false,
      client: { contactPhone: null, displayName: null, incomeType: "FROM_INDIVIDUAL", inn: null },
      requestTime: new Date(),
      operationTime: new Date(date),
      services,
      totalAmount
    });
    if (!approvedReceiptUuid) {
      throw new Error(message || "Failed to add income");
    }
    return approvedReceiptUuid;
  }

  async cancelIncome(receiptUuid: string, comment: string): Promise<INalogCancelIncomeResponse["incomeInfo"]> {
    const { incomeInfo, message }: INalogCancelIncomeResponse = await this.callMethod("cancel", {
      receiptUuid,
      comment,
      partnerCode: null,
      requestTime: new Date()
    });
    if (!incomeInfo) {
      throw new Error(message || "Failed to cancel income");
    }
    return incomeInfo;
  }

  // Private method to build receipt path
  // Centralized path formation for receipt endpoints
  // Returns path like: receipt/${inn}/${receiptUuid}/${format}
  async #buildReceiptPath(receiptUuid: string, format: "json" | "print"): Promise<string> {
    const inn = await this.getInn();
    return `receipt/${inn}/${receiptUuid}/${format}`;
  }

  // Get receipt data in JSON format
  // Uses callMethod for proper authentication
  async getReceiptData(receiptUuid: string): Promise<INalogReceiptIncome> {
    const path = await this.#buildReceiptPath(receiptUuid, "json");
    return (await this.callMethod(path)) as INalogReceiptIncome;
  }

  // Get receipt URL for print format
  // Accepts receipt data object and returns print URL
  async getReceiptUrl(receiptData: INalogReceiptIncome): Promise<string> {
    const path = await this.#buildReceiptPath(receiptData.receiptId, "print");
    return `${this.apiUrl}/${path}`;
  }

  // Get approved income receipt (backward compatibility)
  // For json format, uses getReceiptData
  // For print format, uses fetch directly (returns Blob)
  async getApprovedIncome(receiptUuid: string, format: "json" | "print" = "json"): Promise<INalogReceiptIncome | Blob> {
    if (format === "print") {
      // For print format, use fetch directly (returns Blob)
      const path = await this.#buildReceiptPath(receiptUuid, "print");
      const url = `${this.apiUrl}/${path}`;
      const r = await fetch(url);
      return await r.blob();
    }
    // For json format, use getReceiptData which includes authentication
    return await this.getReceiptData(receiptUuid);
  }
}

export default NalogApi;

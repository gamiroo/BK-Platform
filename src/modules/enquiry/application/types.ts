// src/modules/enquiry/application/types.ts
export type EnquirySubmitInput = Readonly<{
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}>;
